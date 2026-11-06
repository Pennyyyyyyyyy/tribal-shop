import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { notifyManager } from "../service/notify";

// FastAPI 只保留 vision（ML 影像辨識）；商品列表已搬到 Worker。
// API_BASE_URL 仍指 FastAPI，供 ScanPage 的 /vision/detect-product 使用。
// ⚠️ 不要加 `?.` optional chaining — Vite 的靜態替換只認精確的
// `import.meta.env.XXX`，加 `?.` 會落到 runtime lookup 拿 undefined。
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// Worker：商品列表、結帳、admin。自動移除結尾斜線避免產生雙斜線 //。
const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL || "https://flying-squirrel-shop-staging.autocheckout2025.workers.dev").replace(/\/+$/, "");

// 遊客結帳（送出存證）後多久還沒付完款就通知店長
const PAYMENT_TIMEOUT_MS = 10 * 60 * 1000;

const MOCK_ITEMS = [
  { id: 1, name: "蘋果", price: 30, image: "🍎" },
  { id: 2, name: "香蕉", price: 25, image: "🍌" },
  { id: 3, name: "沙拉油", price: 120, image: "🧴" },
  { id: 4, name: "蘋果汁", price: 30, image: "🧃" },
  { id: 5, name: "手工餅乾", price: 50, image: "🍪" },
];

const CheckoutContext = createContext(null);

// ── 辨識照片的歸屬 ──────────────────────────────────────────────
// 購物車每件商品帶 scanQty = { [scanId]: 這次辨識貢獻的數量 }。
// 結帳時，只有「還有數量留在購物車」的那幾次辨識，照片才會送出。

const sameItem = (p, targetId, name) => {
  const pId = p.id ?? p.product_id;
  if (pId !== undefined && pId !== null && targetId !== undefined && targetId !== null) {
    return String(pId) === String(targetId);
  }
  return p.name === name;
};

const scanTotal = (scanQty) =>
  Object.values(scanQty || {}).reduce((sum, n) => sum + n, 0);

// 減 1 件時：先扣手動加的數量，扣到只剩辨識來的，才從最近一次辨識扣
function decreaseScanQty(item) {
  const scanQty = item.scanQty;
  if (!scanQty || item.quantity - 1 >= scanTotal(scanQty)) return scanQty;
  const latest = Math.max(...Object.keys(scanQty).map(Number));
  const next = { ...scanQty, [latest]: scanQty[latest] - 1 };
  if (next[latest] <= 0) delete next[latest];
  return next;
}

export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error("useCheckout must be used within CheckoutProvider");
  return ctx;
}

export function CheckoutProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState(MOCK_ITEMS);
  const [isTribalMember, setIsTribalMember] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  // 遊客結帳前的食譜推薦是否已經出現過（每位客人只跳一次）
  const [recipeShown, setRecipeShown] = useState(false);
  // 遊客付款期限（timestamp）。null = 沒有在等付款
  const [paymentDeadline, setPaymentDeadline] = useState(null);

  const startPaymentTimer = useCallback(
    () => setPaymentDeadline(Date.now() + PAYMENT_TIMEOUT_MS),
    []
  );
  const clearPaymentTimer = useCallback(() => setPaymentDeadline(null), []);

  // 期限到了還沒付完 → 通知店長一次。放在 Provider，客人換頁也不會中斷計時
  useEffect(() => {
    if (!paymentDeadline) return;
    const timer = setTimeout(() => {
      notifyManager("payment_timeout");
      setPaymentDeadline(null);
    }, Math.max(0, paymentDeadline - Date.now()));
    return () => clearTimeout(timer);
  }, [paymentDeadline]);

  useEffect(() => {
    (async () => {
      try {
        // 從 Worker 拿商品（只回 is_active=true 的）
        const response = await fetch(`${WORKER_URL}/api/products`);
        if (response.ok) {
          const data = await response.json();
          const list = Array.isArray(data) ? data : data.products;
          setProducts(list && list.length > 0 ? list : MOCK_ITEMS);
        }
      } catch (error) {
        console.warn("後端連接失敗，使用本地 mock 資料:", error);
      }
    })();
  }, []);

  // 辨識照片只放在記憶體（不寫進本機儲存），結帳送出或 resetAll 就清掉
  const [scanPhotos, setScanPhotos] = useState([]); // [{ scanId, blob }]
  const nextScanIdRef = useRef(1);

  // 一次拍照辨識的結果「累加」進購物車（不會蓋掉之前的辨識或手動加的商品）。
  // 回傳這次的 scanId；沒有辨識到任何商品就不記照片。
  const addScannedItems = (scannedItems = [], photoBlob = null) => {
    const items = scannedItems.filter(Boolean);
    const scanId = nextScanIdRef.current++;
    if (items.length === 0) return scanId;
    if (photoBlob) setScanPhotos((prev) => [...prev, { scanId, blob: photoBlob }]);

    setCart((prev) => {
      const nextCart = [...prev];
      for (const rawItem of items) {
        const targetId = rawItem.id ?? rawItem.product_id;
        const qty = Number(rawItem.quantity) || 1;
        const index = nextCart.findIndex((p) => sameItem(p, targetId, rawItem.name));

        if (index === -1) {
          nextCart.push({
            ...rawItem,
            id: targetId !== undefined ? String(targetId) : rawItem.name,
            product_id: targetId !== undefined ? String(targetId) : rawItem.name,
            name: rawItem.name,
            price: Number(rawItem.price) || 0,
            quantity: qty,
            image_url: rawItem.image_url || rawItem.image,
            isManual: false,
            scanQty: { [scanId]: qty },
          });
        } else {
          const cur = nextCart[index];
          nextCart[index] = {
            ...cur,
            image_url: rawItem.image_url || cur.image_url,
            quantity: cur.quantity + qty,
            scanQty: { ...(cur.scanQty || {}), [scanId]: (cur.scanQty?.[scanId] || 0) + qty },
          };
        }
      }
      return nextCart;
    });
    return scanId;
  };

  // 撤銷某一次辨識（「重新拍照」）：扣掉它加進來的數量，照片也丟掉
  const removeScan = (scanId) => {
    setScanPhotos((prev) => prev.filter((p) => p.scanId !== scanId));
    setCart((prev) =>
      prev
        .map((it) => {
          const n = it.scanQty?.[scanId];
          if (!n) return it;
          const scanQty = { ...it.scanQty };
          delete scanQty[scanId];
          return { ...it, quantity: it.quantity - n, scanQty };
        })
        .filter((it) => it.quantity > 0)
    );
  };

  // 結帳時要送的辨識照片：還有商品留在購物車的那幾次。
  // names = 這張照片辨識到、而且還留在購物車的商品名稱（LINE 通知會寫「商品辨識照片：百事可樂」）
  const getCheckoutScanPhotos = () => {
    const namesByScan = new Map();
    for (const it of cart) {
      for (const [id, n] of Object.entries(it.scanQty || {})) {
        if (n <= 0) continue;
        const key = Number(id);
        if (!namesByScan.has(key)) namesByScan.set(key, []);
        namesByScan.get(key).push(it.name);
      }
    }
    return scanPhotos
      .filter((p) => namesByScan.has(p.scanId))
      .map((p) => ({ ...p, names: namesByScan.get(p.scanId) }));
  };

  const addItemsToCart = (items) => {
    if (!items || !items.length) return;
    setCart((prev) => {
      const nextCart = [...prev];
      for (const rawItem of items) {
        if (!rawItem) continue;
        const targetId = rawItem.id ?? rawItem.product_id;
        const qty = Number(rawItem.quantity) || 1;
        const index = nextCart.findIndex((p) => {
          const pId = p.id ?? p.product_id;
          if (pId !== undefined && pId !== null && targetId !== undefined && targetId !== null) {
            return String(pId) === String(targetId);
          }
          return p.name === rawItem.name;
        });

        if (index === -1) {
          nextCart.push({
            ...rawItem,
            id: targetId !== undefined ? targetId : rawItem.name,
            product_id: targetId !== undefined ? targetId : rawItem.name,
            name: rawItem.name,
            price: Number(rawItem.price) || 0,
            quantity: qty,
            image_url: rawItem.image_url || rawItem.image,
          });
        } else {
          nextCart[index] = {
            ...nextCart[index],
            image_url: rawItem.image_url || nextCart[index].image_url,
            quantity: nextCart[index].quantity + qty,
          };
        }
      }
      return nextCart;
    });
  };

  const addItemToCart = (item) => {
    if (item) addItemsToCart([item]);
  };

  const increaseQty = (id) => {
    setCart((prev) =>
      prev.map((it) => {
        const itId = it.id ?? it.product_id;
        return String(itId) === String(id)
          ? { ...it, quantity: it.quantity + 1 }
          : it;
      })
    );
  };

  const decreaseQty = (id) => {
    setCart((prev) => {
      const target = prev.find((it) => {
        const itId = it.id ?? it.product_id;
        return String(itId) === String(id);
      });
      if (!target) return prev;
      if (target.quantity <= 1) {
        return prev.filter((it) => {
          const itId = it.id ?? it.product_id;
          return String(itId) !== String(id);
        });
      }
      return prev.map((it) => {
        const itId = it.id ?? it.product_id;
        return String(itId) === String(id)
          ? { ...it, quantity: it.quantity - 1, scanQty: decreaseScanQty(it) }
          : it;
      });
    });
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const resetAll = () => {
    setCart([]);
    setIsTribalMember(false);
    setPaymentMethod(null);
    setRecipeShown(false);
    setPaymentDeadline(null);
    setScanPhotos([]);
  };

  return (
    <CheckoutContext.Provider
      value={{
        cart,
        setCart,
        addItemToCart,
        addItemsToCart,
        addScannedItems,
        removeScan,
        getCheckoutScanPhotos,
        increaseQty,
        decreaseQty,
        products,
        isTribalMember,
        setIsTribalMember,
        paymentMethod,
        setPaymentMethod,
        recipeShown,
        setRecipeShown,
        totalAmount,
        cartCount,
        resetAll,
        startPaymentTimer,
        clearPaymentTimer,
        API_BASE_URL,
        WORKER_URL,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  );
}

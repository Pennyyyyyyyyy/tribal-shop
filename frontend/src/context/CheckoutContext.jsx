import React, { createContext, useContext, useEffect, useState } from "react";

// FastAPI 只保留 vision（ML 影像辨識）；商品列表已搬到 Worker。
// API_BASE_URL 仍指 FastAPI，供 ScanPage 的 /vision/detect-product 使用。
// ⚠️ 不要加 `?.` optional chaining — Vite 的靜態替換只認精確的
// `import.meta.env.XXX`，加 `?.` 會落到 runtime lookup 拿 undefined。
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// Worker：商品列表、結帳、admin。
const WORKER_URL =
  import.meta.env.VITE_WORKER_URL || "http://localhost:8787";

const MOCK_ITEMS = [
  { id: 1, name: "蘋果", price: 30, image: "🍎" },
  { id: 2, name: "香蕉", price: 25, image: "🍌" },
  { id: 3, name: "沙拉油", price: 120, image: "🧴" },
  { id: 4, name: "蘋果汁", price: 30, image: "🧃" },
  { id: 5, name: "手工餅乾", price: 50, image: "🍪" },
];

const CheckoutContext = createContext(null);

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

  const addItemToCart = (item) => {
    if (!item) return;
    setCart((prev) => {
      const index = prev.findIndex((p) => p.id === item.id);
      if (index === -1) return [...prev, item];
      const newCart = [...prev];
      newCart[index] = {
        ...newCart[index],
        quantity: newCart[index].quantity + item.quantity,
      };
      return newCart;
    });
  };

  const increaseQty = (id) => {
    setCart((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, quantity: it.quantity + 1 } : it
      )
    );
  };

  const decreaseQty = (id) => {
    setCart((prev) => {
      const target = prev.find((it) => it.id === id);
      if (!target) return prev;
      if (target.quantity <= 1) return prev.filter((it) => it.id !== id);
      return prev.map((it) =>
        it.id === id ? { ...it, quantity: it.quantity - 1 } : it
      );
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
  };

  return (
    <CheckoutContext.Provider
      value={{
        cart,
        addItemToCart,
        increaseQty,
        decreaseQty,
        products,
        isTribalMember,
        setIsTribalMember,
        paymentMethod,
        setPaymentMethod,
        totalAmount,
        cartCount,
        resetAll,
        API_BASE_URL,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  );
}

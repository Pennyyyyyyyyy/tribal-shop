import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import CameraView from "../components/CameraView";

const CONFIRM_THRESHOLD = 0.78;

function getRandomMockItem(products) {
  const base = products[Math.floor(Math.random() * products.length)];
  const confidence = Math.round((0.55 + Math.random() * 0.43) * 100) / 100;
  return { ...base, quantity: 1, confidence };
}

export default function ScanPage() {
  const navigate = useNavigate();
  const { products, cart, addItemToCart, totalAmount } = useCheckout();

  const [scanNonce, setScanNonce] = useState(0);
  const [scanPhase, setScanPhase] = useState("SCANNING");
  const [pendingItem, setPendingItem] = useState(null);
  const [lastAddedItem, setLastAddedItem] = useState(null);

  useEffect(() => {
    setScanPhase("SCANNING");
    setPendingItem(null);

    const t1 = setTimeout(() => {
      const item = getRandomMockItem(products);
      const ok = (item.confidence || 0) >= CONFIRM_THRESHOLD;

      if (ok) {
        addItemToCart(item);
        setLastAddedItem(item);
        setScanPhase("AUTO_ADDED");

        const t2 = setTimeout(() => setScanNonce((n) => n + 1), 900);
        window.__scan_t2 = t2;
      } else {
        setPendingItem(item);
        setScanPhase("CONFIRM");
      }
    }, 1200);

    return () => {
      clearTimeout(t1);
      if (window.__scan_t2) clearTimeout(window.__scan_t2);
    };
  }, [scanNonce, products]);

  const restartScan = () => setScanNonce((n) => n + 1);

  const handleConfirmPending = () => {
    if (!pendingItem) return;
    addItemToCart(pendingItem);
    setLastAddedItem(pendingItem);
    setPendingItem(null);
    setScanPhase("AUTO_ADDED");

    if (window.__scan_loop_t) clearTimeout(window.__scan_loop_t);
    window.__scan_loop_t = setTimeout(() => restartScan(), 900);
  };

  const handleRejectPending = () => {
    setPendingItem(null);
    setLastAddedItem(null);
    restartScan();
  };

  const title =
    scanPhase === "CONFIRM"
      ? "請確認商品"
      : scanPhase === "AUTO_ADDED"
        ? "已加入商品"
        : "辨識中...";

  const subtitle =
    scanPhase === "CONFIRM"
      ? "系統不太確定，請您看一下是否正確。"
      : scanPhase === "AUTO_ADDED"
        ? "請繼續放下一樣商品到鏡頭前。"
        : "請把商品放在鏡頭中央。";

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-col md:flex-row gap-8 w-full flex-1 min-h-0">
        <div className="flex-1 flex flex-col justify-center space-y-4">
          <h2 className="text-3xl font-bold text-slate-800">{title}</h2>
          <p className="text-xl text-slate-600">{subtitle}</p>
          <p className="text-sm text-slate-500">
            若不是這個商品，按「不是，重掃」即可。
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="relative">
            <CameraView
              label="SCANNING CAM"
              status={scanPhase === "SCANNING" ? "SCANNING" : "LIVE"}
            >
              {scanPhase === "SCANNING" && (
                <div className="flex items-center justify-center h-full">
                  <div className="bg-black/60 text-slate-100 px-6 py-4 rounded-2xl text-center">
                    <div className="text-2xl mb-2">🔍 辨識中...</div>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full bg-slate-200 animate-bounce" />
                      <span className="w-3 h-3 rounded-full bg-slate-200 animate-bounce [animation-delay:0.15s]" />
                      <span className="w-3 h-3 rounded-full bg-slate-200 animate-bounce [animation-delay:0.3s]" />
                    </div>
                    <div className="text-xs text-slate-300">
                      （模擬）約 1 秒後顯示結果
                    </div>
                  </div>
                </div>
              )}

              {scanPhase === "AUTO_ADDED" && lastAddedItem && (
                <div className="flex items-center justify-center h-full">
                  <div className="bg-emerald-600/90 text-white px-6 py-5 rounded-2xl text-center shadow-xl">
                    <div className="text-3xl mb-2">✅ 已加入</div>
                    <div className="text-xl font-semibold">
                      {lastAddedItem.image} {lastAddedItem.name}　$
                      {lastAddedItem.price}
                    </div>
                    <div className="text-sm opacity-90 mt-1">
                      請放下一樣商品到鏡頭前
                    </div>
                  </div>
                </div>
              )}
            </CameraView>

            {scanPhase === "CONFIRM" && pendingItem && (
              <div className="absolute inset-0 flex items-end justify-center pb-6 px-4">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6">
                  <div className="flex items-center gap-4">
                    <div className="text-5xl">{pendingItem.image}</div>
                    <div className="flex-1">
                      <div className="text-xl font-bold text-slate-800">
                        {pendingItem.name}
                      </div>
                      <div className="text-slate-600 mt-1">
                        金額：${pendingItem.price}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        信心度：
                        {Math.round((pendingItem.confidence || 0) * 100)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                    <button
                      data-testid="btn-confirm-item"
                      onClick={handleConfirmPending}
                      className="w-full px-5 py-4 rounded-2xl bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-500 shadow-lg transition-transform hover:scale-105 active:scale-95"
                    >
                      ✅ 是，加入清單
                    </button>
                    <button
                      data-testid="btn-reject-item"
                      onClick={handleRejectPending}
                      className="w-full px-5 py-4 rounded-2xl bg-slate-200 text-slate-800 font-semibold text-lg hover:bg-slate-300 shadow-md transition-transform hover:scale-105 active:scale-95"
                    >
                      ↩️ 不是，重掃
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 bg-white rounded-2xl border border-slate-200 px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="shrink-0 text-slate-700">
            <div className="text-sm text-slate-500">目前已加入</div>
            <div className="text-xl font-bold">
              {cart.length} 項　<span className="text-slate-400">/</span> $
              {totalAmount}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex justify-center">
            {lastAddedItem ? (
              <div className="w-full max-w-xl bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="text-3xl shrink-0">{lastAddedItem.image}</div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">上一個加入</div>
                  <div className="text-lg font-bold text-slate-800 truncate">
                    {lastAddedItem.name} x{lastAddedItem.quantity}
                  </div>
                </div>
                <div className="ml-auto text-lg font-bold text-emerald-700 shrink-0">
                  ${lastAddedItem.price}
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-sm">尚未加入商品</div>
            )}
          </div>

          <button
            data-testid="btn-view-cart"
            onClick={() => navigate("/cart")}
            className="shrink-0 px-6 py-4 rounded-2xl bg-sky-600 text-white font-bold text-lg hover:bg-sky-500 shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            🛒 查看清單
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import CameraView from "../components/CameraView";
import { useVoiceCommand } from "../hooks/useVoiceCommand";

const isE2E = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("e2e") === "true";

export default function ScanPage() {
  const navigate = useNavigate();
  const { products, cart, addItemToCart, totalAmount, API_BASE_URL } = useCheckout();

  const [scanPhase, setScanPhase] = useState("IDLE"); // IDLE, SCANNING, RESULT
  const [scannedResults, setScannedResults] = useState([]);
  const [lastAddedItem, setLastAddedItem] = useState(null);
  const [quantities, setQuantities] = useState({});
  const scanVideoRef = useRef(null);

  const getQty = (idx) => quantities[idx] || 1;
  const setQty = (idx, val) => {
    if (val < 1) val = 1;
    if (val > 99) val = 99;
    setQuantities((prev) => ({ ...prev, [idx]: val }));
  };

  const callVisionAPI = async (blob) => {
    const formData = new FormData();
    formData.append("image", blob, "frame.jpg");
    const resp = await fetch(`${API_BASE_URL}/vision/detect-product`, {
      method: "POST",
      body: formData,
    });
    return resp.json();
  };

  const doScan = async () => {
    setScanPhase("SCANNING");
    setScannedResults([]);

    if (isE2E) {
      const base = products.slice(0, 3).map(p => ({ ...p, quantity: 1, confidence: 0.5, isMock: true }));
      setScannedResults(base);
      setScanPhase("RESULT");
      return;
    }

    const video = scanVideoRef.current;
    if (video && video.videoWidth) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
        
        const data = await callVisionAPI(blob);
        if (data.status === "success" && data.predictions) {
          setScannedResults(data.predictions.map(i => ({ ...i, quantity: 1, isMock: false })));
          setScanPhase("RESULT");
          return;
        }
      } catch (err) {
        console.warn("API 失敗，切換至備用模式", err);
      }
    }

    // Fallback 50% 邏輯
    const fallback = products.slice(0, 3).map(p => ({ ...p, quantity: 1, confidence: 0.5, isMock: true }));
    setScannedResults(fallback);
    setScanPhase("RESULT");
  };

  const handleSelectProduct = (item, qty = 1) => {
    addItemToCart({ ...item, quantity: qty });
    setLastAddedItem({ ...item, quantity: qty });
    setScannedResults([]);
    setQuantities({});
    setScanPhase("IDLE");
  };

  // 註冊語音指令
  useVoiceCommand({
    "拍照": () => { if (scanPhase !== "SCANNING") doScan(); },
    "辨識": () => { if (scanPhase !== "SCANNING") doScan(); },
    "重新辨識": () => { if (scanPhase === "RESULT") doScan(); },
    "結帳": () => { if (cart.length > 0) navigate("/cart"); },
    "查看清單": () => { if (cart.length > 0) navigate("/cart"); }
  });

  return (
    <div className="w-full h-full flex flex-col bg-slate-50">
      <div className="flex flex-col md:flex-row gap-8 w-full flex-1 p-6 min-h-0 overflow-y-auto">
        
        {/* 左側：結果顯示 */}
        <div className="flex-1 flex flex-col justify-center space-y-4">
          {scanPhase === "RESULT" ? (
            <>
              <h2 className="text-3xl font-bold text-slate-800">辨識結果</h2>
              <p className="text-sm text-slate-500">點選卡片即可加入購物車</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {scannedResults.map((item, idx) => {
                  const qty = getQty(idx);
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSelectProduct(item, qty)}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:border-indigo-500 hover:shadow-md active:scale-95 transition-all"
                    >
                      <div className="aspect-square bg-slate-50 flex items-center justify-center p-3">
                        {item.image_url ? (
                          <img
                            src={item.image_url.startsWith("http") ? item.image_url : item.image_url.replace("/uploads/product_photos/", "/photo/")}
                            alt={item.name}
                            className="max-w-full max-h-full object-contain mx-auto"
                          />
                        ) : (
                          <div className="text-6xl">{item.image || "📦"}</div>
                        )}
                      </div>
                      <div className="p-3 flex flex-col gap-1.5">
                        <div className="text-sm font-bold text-slate-800 truncate">{item.name}</div>
                        <div className="text-base font-bold text-emerald-700">${item.price}</div>
                        <div className="text-xs text-slate-400">
                          辨識信心度：{Math.round((item.confidence || 0) * 100)}% {item.isMock && "(模擬)"}
                        </div>
                        <div
                          className="flex items-center justify-center gap-1.5 pt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setQty(idx, qty - 1)}
                            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 text-base font-bold hover:bg-slate-200 active:scale-95 transition"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-base font-bold text-slate-800">{qty}</span>
                          <button
                            onClick={() => setQty(idx, qty + 1)}
                            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 text-base font-bold hover:bg-slate-200 active:scale-95 transition"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-slate-800">{scanPhase === "SCANNING" ? "辨識中..." : "商品掃描"}</h2>
              <p className="text-lg text-slate-600">{scanPhase === "SCANNING" ? "正在辨識中..." : "請將商品對準鏡頭拍照。"}</p>
              {lastAddedItem && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-emerald-800 text-sm">
                  已加入：<b>{lastAddedItem.name}</b>
                </div>
              )}
            </>
          )}
          <button onClick={() => navigate("/products")} className="w-full py-4 rounded-2xl bg-white border border-slate-300 font-bold text-slate-600">手動選擇商品</button>
        </div>

        {/* 右側：相機預覽 */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <CameraView
            mode="external"
            label="SCANNING"
            status={scanPhase === "SCANNING" ? "SCANNING" : "LIVE"}
            videoRef={scanVideoRef}
          />
          <button onClick={doScan} disabled={scanPhase === "SCANNING"}
            className={`w-full max-w-xl py-5 rounded-3xl text-2xl font-bold shadow-lg transition-all ${
              scanPhase === "SCANNING" ? "bg-slate-300 text-slate-500" : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}>
            {scanPhase === "SCANNING" ? "辨識中..." : scanPhase === "RESULT" ? "🔄 重新辨識" : "📷 拍照辨識"}
          </button>
        </div>
      </div>

      {/* 底部購物車狀態欄 */}
      <div className="px-6 pb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl relative">
              🛒 {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">{cart.length}</span>}
            </div>
            <div>
              <div className="text-slate-400 text-sm">總計金額</div>
              <div className="text-2xl font-black text-slate-800">${totalAmount}</div>
            </div>
          </div>
          <button onClick={() => navigate("/cart")} disabled={cart.length === 0}
            className={`px-10 py-4 rounded-2xl font-bold text-lg transition-all ${cart.length > 0 ? "bg-sky-500 text-white shadow-md hover:bg-sky-600" : "bg-slate-200 text-slate-400"}`}>
            查看清單 →
          </button>
        </div>
      </div>
    </div>
  );
}
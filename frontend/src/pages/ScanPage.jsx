import React, { useRef, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import CameraView from "../components/CameraView";
import { useVoiceCommand } from "../hooks/useVoiceCommand";
import { useVoiceInstruction } from "../hooks/useVoiceInstruction";

const isE2E = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("e2e") === "true";

export default function ScanPage() {
  const navigate = useNavigate();
  const { products, cart, addItemToCart, totalAmount, API_BASE_URL } = useCheckout();

  const [scanPhase, setScanPhase] = useState("IDLE"); // IDLE, SCANNING, RESULT
  const [scannedResults, setScannedResults] = useState([]);
  const [lastAddedItem, setLastAddedItem] = useState(null);
  const scanVideoRef = useRef(null);

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

  const handleSelectProduct = (item) => {
    const payload = { ...item, quantity: 1 };
    addItemToCart(payload);
    setLastAddedItem(payload);
    setScannedResults([]);
    setScanPhase("IDLE");
  };

  // 解決語音辨識頻繁重啟當機：將每次渲染會改變的 function 透過 useRef 存起來
  const commandsRef = useRef({});
  useEffect(() => {
    commandsRef.current = {
      "拍照": () => { if (scanPhase !== "SCANNING") doScan(); },
      "辨識": () => { if (scanPhase !== "SCANNING") doScan(); },
      "重新辨識": () => { if (scanPhase === "RESULT") doScan(); },
      "結帳": () => { if (cart.length > 0) navigate("/cart"); },
      "查看清單": () => { if (cart.length > 0) navigate("/cart"); }
    };
  });

  // 傳給 useVoiceCommand 的物件保持穩定不變 (空依賴陣列)
  const stableCommands = useMemo(() => ({
    "拍照": () => commandsRef.current["拍照"]?.(),
    "辨識": () => commandsRef.current["辨識"]?.(),
    "重新辨識": () => commandsRef.current["重新辨識"]?.(),
    "結帳": () => commandsRef.current["結帳"]?.(),
    "查看清單": () => commandsRef.current["查看清單"]?.()
  }), []);

  useVoiceCommand(stableCommands);

  // 語音指示
  useVoiceInstruction(
    scanPhase === "SCANNING"
      ? "正在辨識中，請稍候"
      : scanPhase === "RESULT"
      ? "辨識完成，請點選畫面加入購物車，或點選重新辨識"
      : "請將商品對準鏡頭，並說出：拍照，不在新增商品請按查看清單",
    [scanPhase]
  );

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex flex-col md:flex-row gap-6 w-full flex-1 min-h-0 p-6 overflow-hidden">

        {/* 左側：結果顯示 */}
        <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
          {scanPhase === "RESULT" ? (
            <>
              <h2 className="text-3xl font-bold text-slate-800 shrink-0">辨識結果</h2>
              <p className="text-sm text-slate-500 shrink-0">點選卡片即可加入購物車</p>
              <div className="flex-1 min-h-0 flex gap-3">
                {scannedResults.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectProduct(item)}
                    className="group flex-1 min-w-0 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-md active:scale-95 transition-all"
                  >
                    <div className="flex-1 min-h-0 bg-slate-50 flex items-center justify-center p-3 transition-colors group-hover:bg-emerald-50">
                      {item.image_url ? (
                        <img
                          src={item.image_url.startsWith("http") ? item.image_url : item.image_url.replace("/uploads/product_photos/", "/photo/")}
                          alt={item.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <div className="text-6xl">{item.image || "📦"}</div>
                      )}
                    </div>
                    <div className="shrink-0 p-3 flex flex-col gap-1">
                      <div className="text-sm font-bold text-slate-800 truncate">{item.name}</div>
                      <div className="text-base font-bold text-emerald-700">${item.price}</div>
                      <div className="text-xs text-slate-400">
                        辨識信心度：{Math.round((item.confidence || 0) * 100)}% {item.isMock && "(模擬)"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <h2 className="text-3xl font-bold text-slate-800 shrink-0">
                {scanPhase === "SCANNING" ? "辨識中..." : "商品掃描"}
              </h2>
              <p className="text-lg text-slate-600 shrink-0">
                {scanPhase === "SCANNING" ? "正在辨識中..." : "請將商品對準鏡頭拍照。"}
              </p>
              {lastAddedItem && (
                <div className="shrink-0 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-emerald-800 text-sm">
                  已加入：<b>{lastAddedItem.name}</b>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => navigate("/products")}
            className="shrink-0 w-full py-3 rounded-2xl bg-white border border-slate-300 font-bold text-slate-600"
          >
            手動選擇商品
          </button>
        </div>

        {/* 右側：相機預覽 */}
        <div className="flex-1 min-h-0 flex flex-col items-center gap-3">
          <div
            className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden"
            style={{ containerType: "size" }}
          >
            <div
              className="aspect-video"
              style={{ width: "min(100cqw, calc(100cqh * 16 / 9))" }}
            >
              <CameraView
                fill
                mode="external"
                label="SCANNING"
                status={scanPhase === "SCANNING" ? "SCANNING" : "LIVE"}
                videoRef={scanVideoRef}
              />
            </div>
          </div>
          <button
            onClick={doScan}
            disabled={scanPhase === "SCANNING"}
            className={`shrink-0 w-full py-4 rounded-3xl text-xl font-bold shadow-lg transition-all ${
              scanPhase === "SCANNING" ? "bg-slate-300 text-slate-500" : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {scanPhase === "SCANNING" ? "辨識中..." : scanPhase === "RESULT" ? "🔄 重新辨識" : "📷 拍照辨識"}
          </button>
        </div>
      </div>

      {/* 底部購物車狀態欄 */}
      <div className="shrink-0 px-6 pb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl relative">
              🛒 {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">{cart.length}</span>}
            </div>
            <div>
              <div className="text-slate-400 text-sm">總計金額</div>
              <div className="text-2xl font-black text-slate-800">${totalAmount}</div>
            </div>
          </div>
          <button
            onClick={() => navigate("/cart")}
            disabled={cart.length === 0}
            className={`px-8 py-3 rounded-2xl font-bold text-lg transition-all ${cart.length > 0 ? "bg-sky-500 text-white shadow-md hover:bg-sky-600" : "bg-slate-200 text-slate-400"}`}
          >
            查看清單 →
          </button>
        </div>
      </div>
    </div>
  );
}
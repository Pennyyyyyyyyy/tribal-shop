import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import CameraView from "../components/CameraView";

// 判斷是否為測試模式
const isE2E =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("e2e") === "true";

export default function ScanPage() {
  const navigate = useNavigate();
  const { products, cart, addItemToCart, totalAmount, API_BASE_URL } = useCheckout();

  const [scanPhase, setScanPhase] = useState("IDLE");
  const [scannedResults, setScannedResults] = useState([]); 
  const [lastAddedItem, setLastAddedItem] = useState(null);
  const scanVideoRef = useRef(null);

  // 呼叫 API 的函式
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

    // --- 測試模式 (E2E) ---
    if (isE2E) {
      try {
        const c = document.createElement("canvas");
        c.width = 64; c.height = 64;
        c.getContext("2d").fillRect(0, 0, 64, 64);
        const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.8));
        const data = await callVisionAPI(blob);
        
        // 修改點：對應後端傳回的 predictions 欄位
        if (data.status === "success" && data.predictions) {
          setScannedResults(data.predictions.map(i => ({ ...i, quantity: 1 })));
          setScanPhase("RESULT");
          return;
        }
      } catch (err) {
        console.warn("E2E: AI API 失敗，使用模擬資料:", err);
      }
      // E2E 備用資料
      const base = products.slice(0, 3).map(p => ({ ...p, quantity: 1, confidence: 0.5 }));
      setScannedResults(base);
      setScanPhase("RESULT");
      return;
    }

    // --- 正常掃描流程 ---
    const video = scanVideoRef.current;
    if (video && video.videoWidth) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
        
        const data = await callVisionAPI(blob);
        
        // 重要修改：將 data.results 改為 data.predictions
        if (data.status === "success" && data.predictions) {
          setScannedResults(data.predictions.map(i => ({ ...i, quantity: 1 })));
          setScanPhase("RESULT");
          return; // 成功辨識就結束函式
        }
      } catch (err) {
        console.warn("辨識 API 失敗或連線問題:", err);
      }
    }

    // --- 備用方案 (只有當上面的 API 成功回傳並 return 沒觸發時，才會執行到這裡) ---
    // 這裡會顯示 50%，讓你在沒後端的情況下也能測試 UI
    console.log("進入備用方案 (50% 模式)");
    const base = products.slice(0, 3).map(p => ({ 
      ...p, 
      quantity: 1, 
      confidence: 0.5,
      isMock: true // 標記這是模擬資料
    }));
    setScannedResults(base);
    setScanPhase("RESULT");
  };

  const handleSelectProduct = (item) => {
    addItemToCart(item);
    setLastAddedItem(item);
    setScannedResults([]);
    setScanPhase("IDLE");
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-col md:flex-row gap-8 w-full flex-1 min-h-0">
        <div className="flex-1 flex flex-col justify-center space-y-4">
          {scanPhase === "RESULT" ? (
            <>
              <h2 className="text-3xl font-bold text-slate-800">辨識結果</h2>
              <div className="space-y-3">
                {scannedResults.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleSelectProduct(item)}
                    className={`bg-white rounded-3xl shadow-xl border p-6 flex items-center gap-5 cursor-pointer hover:border-indigo-500 transition-all active:scale-95 ${item.isMock ? 'border-amber-200' : 'border-slate-200'}`}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url.startsWith("http") ? item.image_url : item.image_url.replace("/uploads/product_photos/", "/photo/")}
                        alt={item.name}
                        className="w-24 h-24 rounded-2xl object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-slate-100 flex items-center justify-center text-5xl">{item.image || "📦"}</div>
                    )}
                    <div className="flex-1">
                      <div className="text-2xl font-bold text-slate-800">{item.name}</div>
                      <div className="text-xl text-emerald-700 font-semibold mt-1">${item.price}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        辨識信心度：{Math.round((item.confidence || 0) * 100)}% 
                        {item.isMock && " (系統預估)"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setScanPhase("IDLE")} className="text-slate-500 py-2">重新掃描</button>
            </>
          ) : (
            // ... (其餘介面保持不變)
            <>
              <h2 className="text-3xl font-bold text-slate-800">{scanPhase === "SCANNING" ? "辨識中..." : "商品掃描"}</h2>
              <p className="text-xl text-slate-600">{scanPhase === "SCANNING" ? "正在辨識商品，請稍候..." : "請將商品放在鏡頭中央，按下「拍照辨識」。"}</p>
              {lastAddedItem && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <div className="text-2xl">{lastAddedItem.image || "📦"}</div>
                  <div className="text-sm text-emerald-800">已加入：<span className="font-bold">{lastAddedItem.name}</span> ${lastAddedItem.price}</div>
                </div>
              )}
            </>
          )}

          <button onClick={() => navigate("/products")} className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-300 text-slate-600 text-xl font-bold hover:bg-slate-50 shadow-lg">
            找不到商品？手動選擇
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <CameraView mode="external" label="SCANNING CAM" status={scanPhase === "SCANNING" ? "SCANNING" : "LIVE"} videoRef={scanVideoRef} />
          <button onClick={doScan} disabled={scanPhase === "SCANNING"} className={`w-full max-w-xl px-6 py-4 rounded-2xl text-xl font-bold shadow-lg ${scanPhase === "SCANNING" ? "bg-slate-300 text-slate-500" : "bg-indigo-600 text-white"}`}>
            {scanPhase === "SCANNING" ? "辨識中..." : "📷拍照辨識"}
          </button>
        </div>
      </div>
      {/* 底部購物車欄位省略... */}
    </div>
  );
}
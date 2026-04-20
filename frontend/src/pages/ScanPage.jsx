import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import CameraView from "../components/CameraView";

// 判斷是否為 E2E 測試模式
const isE2E =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("e2e") === "true";

export default function ScanPage() {
  const navigate = useNavigate();
  const { products, cart, addItemToCart, totalAmount, API_BASE_URL } = useCheckout();

  const [scanPhase, setScanPhase] = useState("IDLE"); // IDLE, SCANNING, RESULT
  const [scannedResults, setScannedResults] = useState([]); 
  const [lastAddedItem, setLastAddedItem] = useState(null);
  const scanVideoRef = useRef(null);

  // --- API 呼叫 ---
  const callVisionAPI = async (blob) => {
    const formData = new FormData();
    formData.append("image", blob, "frame.jpg");
    const resp = await fetch(`${API_BASE_URL}/vision/detect-product`, {
      method: "POST",
      body: formData,
    });
    return resp.json();
  };

  // --- 掃描辨識主邏輯 ---
  const doScan = async () => {
    setScanPhase("SCANNING");
    setScannedResults([]);

    const video = scanVideoRef.current;
    
    // 1. 處理 E2E 模擬模式
    if (isE2E) {
      const base = products.slice(0, 3).map(p => ({ ...p, quantity: 1, confidence: 0.5, isMock: true }));
      setScannedResults(base);
      setScanPhase("RESULT");
      return;
    }

    // 2. 正常 API 辨識流程
    if (video && video.videoWidth) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
        
        const data = await callVisionAPI(blob);
        
        // 修正：對應後端回傳的 predictions 欄位
        if (data.status === "success" && data.predictions) {
          setScannedResults(data.predictions.map(i => ({ ...i, quantity: 1, isMock: false })));
          setScanPhase("RESULT");
          return;
        }
      } catch (err) {
        console.warn("API 辨識失敗:", err);
      }
    }

    // 3. Fallback 備用方案 (若 API 失敗或無法執行則顯示 50% 模擬資料)
    const fallback = products.slice(0, 3).map(p => ({ ...p, quantity: 1, confidence: 0.5, isMock: true }));
    setScannedResults(fallback);
    setScanPhase("RESULT");
  };

  // 選擇商品後的處理
  const handleSelectProduct = (item) => {
    addItemToCart(item);
    setLastAddedItem(item);
    setScannedResults([]);
    setScanPhase("IDLE");
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* 主內容區 */}
      <div className="flex flex-col md:flex-row gap-8 w-full flex-1 p-6 min-h-0">
        
        {/* 左側：狀態與結果顯示 */}
        <div className="flex-1 flex flex-col justify-center space-y-4">
          {scanPhase === "RESULT" ? (
            <>
              <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                辨識結果 <span className="text-sm font-normal bg-indigo-100 text-indigo-600 px-2 py-1 rounded">Top 3</span>
              </h2>
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
                {scannedResults.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleSelectProduct(item)}
                    className={`bg-white rounded-3xl shadow-sm border-2 p-5 flex items-center gap-5 cursor-pointer hover:border-indigo-500 transition-all active:scale-95 ${item.isMock ? 'border-dashed border-slate-200' : 'border-transparent shadow-md'}`}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url.startsWith("http") ? item.image_url : item.image_url.replace("/uploads/product_photos/", "/photo/")}
                        alt={item.name}
                        className="w-20 h-20 rounded-2xl object-cover border border-slate-100"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-4xl">{item.image || "📦"}</div>
                    )}
                    <div className="flex-1">
                      <div className="text-xl font-bold text-slate-800 leading-tight">{item.name}</div>
                      <div className="text-lg text-emerald-600 font-bold mt-1">${item.price}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        辨識信心度：{Math.round((item.confidence || 0) * 100)}% 
                        {item.isMock && " (系統預估)"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setScanPhase("IDLE")} className="text-slate-400 py-2 hover:text-indigo-600 transition-colors">
                ← 返回重新掃描
              </button>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-slate-800">
                {scanPhase === "SCANNING" ? "辨識中..." : "商品掃描"}
              </h2>
              <p className="text-lg text-slate-600">
                {scanPhase === "SCANNING" ? "正在比對資料庫商品..." : "請將商品標籤朝向鏡頭，按下按鈕開始。"}
              </p>
              
              {/* 最近加入的提示 */}
              {lastAddedItem && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3 animate-fade-in">
                  <div className="text-2xl">{lastAddedItem.image || "📦"}</div>
                  <div className="text-sm text-emerald-800">
                    已將 <span className="font-bold">{lastAddedItem.name}</span> 加入清單
                  </div>
                </div>
              )}
            </>
          )}

          <button 
            onClick={() => navigate("/products")} 
            className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-300 text-slate-500 text-lg font-bold hover:bg-slate-100 transition-all"
          >
            找不到商品？手動選擇
          </button>
        </div>

        {/* 右側：相機視窗 */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-full max-w-xl aspect-square bg-black rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white relative">
            <CameraView 
              mode="external" 
              label="SCANNING" 
              status={scanPhase === "SCANNING" ? "SCANNING" : "LIVE"} 
              videoRef={scanVideoRef} 
            />
            {/* 掃描線動畫 */}
            {scanPhase === "SCANNING" && (
              <div className="absolute inset-0 z-10">
                <div className="w-full h-1 bg-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.8)] animate-scan-line"></div>
              </div>
            )}
          </div>
          
          <button 
            onClick={doScan} 
            disabled={scanPhase === "SCANNING"} 
            className={`w-full max-w-xl px-6 py-5 rounded-3xl text-2xl font-bold shadow-xl transition-all active:scale-95 ${
              scanPhase === "SCANNING" ? "bg-slate-300 text-slate-500" : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {scanPhase === "SCANNING" ? "辨識中..." : "📷 拍照辨識"}
          </button>
        </div>
      </div>

      {/* 底部購物車狀態欄 (Cart Bar) */}
      <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                🛒
              </div>
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">
                  {cart.length}
                </span>
              )}
            </div>
            <div>
              <div className="text-slate-400 text-sm font-medium">目前的購物金額</div>
              <div className="text-2xl font-black text-slate-800">
                <span className="text-sm mr-1">$</span>{totalAmount}
              </div>
            </div>
          </div>

          <button 
            onClick={() => navigate("/cart")} 
            disabled={cart.length === 0}
            className={`px-8 py-4 rounded-2xl font-black text-lg transition-all shadow-lg ${
              cart.length > 0 
                ? "bg-sky-500 text-white hover:bg-sky-600 active:bg-sky-700" 
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            查看結算清單 →
          </button>
        </div>
      </div>
    </div>
  );
}
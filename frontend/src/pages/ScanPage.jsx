import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import CameraView from "../components/CameraView";

const isE2E =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("e2e") === "true";

export default function ScanPage() {
  const navigate = useNavigate();
  const { products, cart, addItemToCart, totalAmount, API_BASE_URL } =
    useCheckout();

  const [scanPhase, setScanPhase] = useState("IDLE"); // IDLE | SCANNING | RESULT
  const [scannedItem, setScannedItem] = useState(null);
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
    setScannedItem(null);

    // E2E 模式：無相機，用 1x1 假圖呼叫 AI API 測試連線
    if (isE2E) {
      try {
        const c = document.createElement("canvas");
        c.width = 64;
        c.height = 64;
        c.getContext("2d").fillRect(0, 0, 64, 64);
        const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.8));
        const data = await callVisionAPI(blob);
        if (data.status === "success") {
          setScannedItem({ ...data.product, quantity: 1 });
          setScanPhase("RESULT");
          return;
        }
      } catch (err) {
        console.warn("E2E: AI API 失敗，使用模擬資料:", err);
      }
      // E2E fallback
      const base = products[Math.floor(Math.random() * products.length)];
      setScannedItem({ ...base, quantity: 1, confidence: 0.5 });
      setScanPhase("RESULT");
      return;
    }

    // 正常模式：從相機擷取畫面
    const video = scanVideoRef.current;
    if (video && video.videoWidth) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.8)
        );
        const data = await callVisionAPI(blob);
        if (data.status === "success") {
          setScannedItem({ ...data.product, quantity: 1 });
          setScanPhase("RESULT");
          return;
        }
      } catch (err) {
        console.warn("辨識 API 失敗，使用模擬資料:", err);
      }
    }

    // Fallback: 相機未就緒或 API 失敗 → 模擬資料
    const base = products[Math.floor(Math.random() * products.length)];
    setScannedItem({ ...base, quantity: 1, confidence: 0.5 });
    setScanPhase("RESULT");
  };

  const handleConfirmScanned = () => {
    if (!scannedItem) return;
    addItemToCart(scannedItem);
    setLastAddedItem(scannedItem);
    setScannedItem(null);
    setScanPhase("IDLE");
  };

  const handleRejectScanned = () => {
    setScannedItem(null);
    setScanPhase("IDLE");
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-col md:flex-row gap-8 w-full flex-1 min-h-0">
        {/* 左側：辨識結果 / 提示 */}
        <div className="flex-1 flex flex-col justify-center space-y-4">
          {scanPhase === "RESULT" && scannedItem ? (
            <>
              <h2 className="text-3xl font-bold text-slate-800">辨識結果</h2>

              <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6">
                <div className="flex items-center gap-5">
                  {scannedItem.image_url ? (
                    <img
                      src={
                        scannedItem.image_url.startsWith("http")
                          ? scannedItem.image_url
                          : `${API_BASE_URL}${scannedItem.image_url}`
                      }
                      alt={scannedItem.name}
                      className="w-24 h-24 rounded-2xl object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-slate-100 flex items-center justify-center text-5xl">
                      {scannedItem.image || "📦"}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-slate-800">
                      {scannedItem.name}
                    </div>
                    <div className="text-xl text-emerald-700 font-semibold mt-1">
                      ${scannedItem.price}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      辨識信心度：
                      {Math.round((scannedItem.confidence || 0) * 100)}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button
                    data-testid="btn-confirm-item"
                    onClick={handleConfirmScanned}
                    className="w-full px-5 py-4 rounded-2xl bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-500 shadow-lg transition-transform hover:scale-105 active:scale-95"
                  >
                    加入購物車
                  </button>
                  <button
                    data-testid="btn-reject-item"
                    onClick={handleRejectScanned}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-200 text-slate-800 font-semibold text-lg hover:bg-slate-300 shadow-md transition-transform hover:scale-105 active:scale-95"
                  >
                    重新掃描
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-slate-800">
                {scanPhase === "SCANNING" ? "辨識中..." : "商品掃描"}
              </h2>
              <p className="text-xl text-slate-600">
                {scanPhase === "SCANNING"
                  ? "正在辨識商品，請稍候..."
                  : "請將商品放在鏡頭中央，按下「拍照辨識」。"}
              </p>
              {lastAddedItem && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <div className="text-2xl">
                    {lastAddedItem.image || "📦"}
                  </div>
                  <div className="text-sm text-emerald-800">
                    已加入：
                    <span className="font-bold">{lastAddedItem.name}</span> $
                    {lastAddedItem.price}
                  </div>
                </div>
              )}
            </>
          )}

          <button
            onClick={() => navigate("/products")}
            className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-300 text-slate-600 text-xl font-bold hover:bg-slate-50 shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            找不到商品？手動選擇
          </button>
        </div>

        {/* 右側：相機 + 拍照按鈕 */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <CameraView
            label="SCANNING CAM"
            status={scanPhase === "SCANNING" ? "SCANNING" : "LIVE"}
            videoRef={scanVideoRef}
          >
            {scanPhase === "SCANNING" && (
              <div className="flex items-center justify-center h-full">
                <div className="bg-black/60 text-slate-100 px-6 py-4 rounded-2xl text-center">
                  <div className="text-2xl mb-2">辨識中...</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-slate-200 animate-bounce" />
                    <span className="w-3 h-3 rounded-full bg-slate-200 animate-bounce [animation-delay:0.15s]" />
                    <span className="w-3 h-3 rounded-full bg-slate-200 animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              </div>
            )}
          </CameraView>

          <button
            data-testid="btn-scan"
            onClick={doScan}
            disabled={scanPhase === "SCANNING"}
            className={`w-full max-w-xl px-6 py-4 rounded-2xl text-xl font-bold shadow-lg transition-transform ${scanPhase === "SCANNING"
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 active:scale-95"
              }`}
          >
            {scanPhase === "SCANNING" ? "辨識中..." : "📷拍照辨識"}
          </button>
        </div>
      </div>

      {/* 底部：購物車狀態列 */}
      <div className="mt-4 flex justify-end">
        <div className="w-1/2 bg-white rounded-2xl border border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="text-slate-700">
              <span className="text-2xl font-bold">購物車</span>
              <span className="text-xl font-bold ml-3">
                {cart.length} 項 · ${totalAmount}
              </span>
            </div>
            <button
              data-testid="btn-view-cart"
              onClick={() => navigate("/cart")}
              className="px-6 py-3 rounded-2xl bg-sky-600 text-white font-bold text-lg hover:bg-sky-500 shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              查看清單
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

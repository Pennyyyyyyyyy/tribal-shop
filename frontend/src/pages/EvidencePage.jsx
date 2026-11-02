import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import CameraView from "../components/CameraView";
import { useVoiceInstruction } from "../hooks/useVoiceInstruction";

const isE2E =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("e2e") === "true";

export default function EvidencePage() {
  const navigate = useNavigate();
  const { cart, totalAmount, WORKER_URL, resetAll, isTribalMember } =
    useCheckout();
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const evidenceVideoRef = useRef(null);
  const evidenceCanvasRef = useRef(null);

  const [camReady, setCamReady] = useState(false);
  const [camErr, setCamErr] = useState("");
  const [evidenceSnapshot, setEvidenceSnapshot] = useState(null);
  const [isSavingEvidence, setIsSavingEvidence] = useState(false);

  const takeEvidencePhoto = () => {
    setCamErr("");
    const video = evidenceVideoRef.current;
    const canvas = evidenceCanvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setCamErr("尚未取得相機畫面，請稍候相機顯示後再拍照。");
      return;
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setEvidenceSnapshot(dataUrl);
  };

  const submitEvidence = async () => {
    if (!evidenceSnapshot || isSavingEvidence) return;

    setIsSavingEvidence(true);
    try {
      const formData = new FormData();

      // 將拍照的 base64 轉為圖片檔案 (Blob)
      const response = await fetch(evidenceSnapshot);
      const photoBlob = await response.blob();

      // 1. 放入購物車與金額
      formData.append("cart_items", JSON.stringify(cart));
      formData.append("total_amount", totalAmount);
      
      // 2. 標記交易類型（讓 Cloudflare 判斷是否要發 LINE 通知店長）
      formData.append("transaction_type", isTribalMember ? "credit" : "cash");
      
      // 3. 放入存證照片
      formData.append("photo", photoBlob, "evidence.jpg");

      // 走 VITE_WORKER_URL 環境變數 — 開發指 staging、正式切 production 都在 .env 換掉即可，不動 code。
      const uploadResponse = await fetch(`${WORKER_URL}/checkout`, {
        method: "POST",
        body: formData,
        // 瀏覽器會自動處理 multipart/form-data 的 boundary，所以不需手動設 headers
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Cloudflare 處理失敗: ${errorText}`);
      }

      // 結帳成功後的處理
      if (isTribalMember) {
        resetAll();
        navigate("/"); // 族人賒帳完回首頁，店長會在 LINE 收到確認通知
      } else {
        navigate("/payment"); // 一般遊客導向支付
      }
    } catch (error) {
      console.error("結帳失敗細節:", error);
      alert("結帳系統連線失敗，請檢查網路或聯繫店長。");
    } finally {
      setIsSavingEvidence(false);
    }
  };

  // 語音指示
  useVoiceInstruction(
    evidenceSnapshot 
      ? "已完成拍照，確認無誤請點選確認送出，或重新拍攝" 
      : "請看著鏡頭，把臉對準框內，準備好後請點擊拍照",
    [evidenceSnapshot]
  );

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_360px] gap-8">
      <section className="flex flex-col gap-3.5 min-h-0">
        <h1 className="font-display text-[38px]">拍照存證</h1>
        <div className="flex-1 min-h-0 relative overflow-hidden bg-cocoa border-[3px] border-ink rounded-[28px] shadow-press-lg">
          {evidenceSnapshot ? (
            <img
              src={evidenceSnapshot}
              alt="存證照片"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <CameraView
              mode="internal"
              bare
              videoRef={evidenceVideoRef}
              onReadyChange={setCamReady}
              onErrorChange={setCamErr}
            >
              {/* 臉部對位框 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[58%] h-[78%] border-4 border-dashed border-peach/80 rounded-[40%_40%_24px_24px/30%_30%_24px_24px] flex items-end justify-center pb-5">
                  <span className="bg-peach/90 text-ink rounded-xl px-3.5 py-1.5 text-base font-bold">
                    請將臉放在框內
                  </span>
                </div>
              </div>
            </CameraView>
          )}

          <div className="absolute inset-x-0 bottom-0 px-6 py-4 bg-cocoa/85 text-cream text-lg text-center">
            {evidenceSnapshot
              ? "已拍好照片，確認沒問題請按「送出」，或按「重拍」"
              : "請看著鏡頭，把臉對準框內，準備好後按「拍照」"}
          </div>
        </div>
        <canvas ref={evidenceCanvasRef} className="hidden" />
      </section>

      <aside className="flex flex-col gap-[18px] pt-[58px] min-h-0">
        <div className="panel px-6 py-[22px] flex flex-col gap-3">
          <h2 className="font-display text-2xl">拍照小提示</h2>
          <p className="text-lg leading-[1.7]">
            把臉放在畫面中央。照片會傳給店長，用來確認這筆消費。
          </p>
        </div>

        <div className="bg-paper border-[3px] border-sand rounded-[22px] px-6 py-[18px] flex justify-between items-baseline">
          <span className="text-[17px]">本次 {itemCount} 件</span>
          <span className="font-display text-[30px] text-forest">NT${totalAmount}</span>
        </div>

        {camErr && (
          <div className="border-2 border-clay bg-peach rounded-2xl px-4 py-3 text-base font-medium">
            相機：{camErr}
          </div>
        )}

        {isE2E && !evidenceSnapshot && (
          <button
            data-testid="btn-skip-photo"
            onClick={() => {
              const c = document.createElement("canvas");
              c.width = 640;
              c.height = 480;
              const ctx = c.getContext("2d");
              ctx.fillStyle = "#888";
              ctx.fillRect(0, 0, 640, 480);
              ctx.fillStyle = "#fff";
              ctx.font = "32px sans-serif";
              ctx.fillText("E2E mock photo", 180, 250);
              setEvidenceSnapshot(c.toDataURL("image/jpeg", 0.9));
            }}
            className="btn-ghost h-12 text-base"
          >
            [E2E] 跳過拍照
          </button>
        )}

        <div className="mt-auto flex flex-col gap-[18px]">
          {evidenceSnapshot ? (
            <>
              <button
                data-testid="btn-submit-evidence"
                onClick={submitEvidence}
                disabled={isSavingEvidence}
                className="btn-press h-24 bg-clay text-paper text-[34px]"
              >
                {isSavingEvidence ? "送出中..." : "送出"}
              </button>
              <button
                data-testid="btn-retake-photo"
                onClick={() => setEvidenceSnapshot(null)}
                disabled={isSavingEvidence}
                className="btn-ghost h-14 text-lg"
              >
                重拍
              </button>
            </>
          ) : (
            <>
              <button
                data-testid="btn-take-photo"
                onClick={takeEvidencePhoto}
                disabled={!camReady || isSavingEvidence}
                className="btn-press h-24 bg-clay text-paper text-[34px] gap-3.5"
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                拍照
              </button>
              <button
                onClick={() => navigate("/cart")}
                disabled={isSavingEvidence}
                className="btn-ghost h-14 text-lg"
              >
                返回購物車
              </button>
            </>
          )}
          <p className="text-sm opacity-70 text-center">
            隱私說明：存證僅用於對帳與核對；店家不會任意對外公開。
          </p>
        </div>
      </aside>
    </div>
  );
}

import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import CameraView from "../components/CameraView";

const isE2E =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("e2e") === "true";

export default function EvidencePage() {
  const navigate = useNavigate();
  const { cart, totalAmount, API_BASE_URL, resetAll } = useCheckout();

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

      const response = await fetch(evidenceSnapshot);
      const photoBlob = await response.blob();

      formData.append("cart_items", JSON.stringify(cart));
      formData.append("total_amount", totalAmount);
      formData.append("photo", photoBlob, "evidence.jpg");

      const uploadResponse = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("上傳存證失敗");
      }

      resetAll();
      navigate("/");
    } catch (error) {
      console.error("上傳存證出錯:", error);
      alert("上傳存證失敗，請重試");
    } finally {
      setIsSavingEvidence(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row w-full h-full gap-8">
      <div className="flex-1 flex flex-col justify-center space-y-4">
        <h2 className="text-3xl font-bold text-slate-800">拍照存證</h2>
        <p className="text-lg text-slate-600">
          請把「人＋商品」一起拍進畫面（臉要清楚、商品拿在胸前）。
        </p>

        {camErr && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl px-4 py-3 text-sm">
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
            className="px-6 py-3 rounded-2xl bg-amber-500 text-white font-bold shadow-md"
          >
            [E2E] 跳過拍照
          </button>
        )}

        <div className="mt-2 flex flex-col sm:flex-row gap-4">
          {evidenceSnapshot ? (
            <button
              data-testid="btn-retake-photo"
              onClick={() => setEvidenceSnapshot(null)}
              disabled={isSavingEvidence}
              className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 text-slate-700 text-lg font-semibold shadow-md hover:bg-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
            >
              🔄 重拍
            </button>
          ) : (
            <button
              data-testid="btn-take-photo"
              onClick={takeEvidencePhoto}
              disabled={!camReady || isSavingEvidence}
              className={`flex-1 px-6 py-4 rounded-2xl text-lg font-bold shadow-lg transition-transform ${
                !camReady || isSavingEvidence
                  ? "bg-slate-300 text-slate-600 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 active:scale-95"
              }`}
            >
              📸 拍照
            </button>
          )}

          <button
            onClick={() => navigate("/cart")}
            disabled={isSavingEvidence}
            className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 text-slate-700 text-lg font-semibold shadow-md hover:bg-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
          >
            ⬅ 返回購物車
          </button>
        </div>

        <button
          data-testid="btn-submit-evidence"
          onClick={submitEvidence}
          disabled={!evidenceSnapshot || isSavingEvidence}
          className={`w-full px-6 py-4 rounded-2xl text-xl font-bold shadow-lg transition-transform ${
            !evidenceSnapshot || isSavingEvidence
              ? "bg-slate-300 text-slate-600 cursor-not-allowed"
              : "bg-slate-900 text-white hover:bg-slate-800 hover:scale-105 active:scale-95"
          }`}
        >
          {isSavingEvidence ? "送出中..." : "📤 送出"}
        </button>

        <p className="text-xs text-slate-500">
          隱私說明：存證僅用於對帳與核對；店家不會任意對外公開。
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-full max-w-xl">
          <div className="relative w-full aspect-video bg-black rounded-3xl shadow-2xl overflow-hidden border-4 border-slate-800">
            {evidenceSnapshot ? (
              <img
                src={evidenceSnapshot}
                alt="Evidence"
                className="w-full h-full object-cover"
              />
            ) : (
              <CameraView
                mode="internal"
                label="EVIDENCE CAM"
                status="STANDBY"
                videoRef={evidenceVideoRef}
                onReadyChange={setCamReady}
                onErrorChange={setCamErr}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/50 text-slate-100 px-5 py-3 rounded-2xl text-sm text-center">
                    <div className="font-semibold mb-1">拍照小提示</div>
                    <div>請把臉和商品放在畫面中央</div>
                  </div>
                </div>
              </CameraView>
            )}

            <div className="absolute inset-x-0 bottom-6 flex justify-center">
              <div className="bg-black/60 text-slate-100 px-6 py-3 rounded-2xl text-sm">
                {evidenceSnapshot
                  ? "✅ 已拍照，請按「送出」"
                  : "相機就緒後按「拍照」"}
              </div>
            </div>
          </div>

          <canvas ref={evidenceCanvasRef} className="hidden" />
        </div>
      </div>
    </div>
  );
}

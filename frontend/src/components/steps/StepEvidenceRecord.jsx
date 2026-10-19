// src/components/steps/StepEvidenceRecord.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

function StepEvidenceRecord({ isSavingEvidence, onBackPayment, onSubmitEvidence }) {
  // photo
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [camStream, setCamStream] = useState(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);

  // audio
  const [micStream, setMicStream] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);

  // permission / error
  const [camError, setCamError] = useState("");
  const [micError, setMicError] = useState("");

  const canSubmit = useMemo(() => !!photoDataUrl && !!audioBlob && !isSavingEvidence, [
    photoDataUrl,
    audioBlob,
    isSavingEvidence,
  ]);

  // init camera preview (video only, for taking a snapshot)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (!mounted) return;
        setCamStream(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        setCamError(
          "無法開啟相機。請確認瀏覽器已允許相機權限，或檢查是否被系統/Chrome 阻擋。"
        );
      }
    })();

    return () => {
      mounted = false;
      if (camStream) camStream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureMicStream = async () => {
    if (micStream) return micStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setMicStream(stream);
      return stream;
    } catch (e) {
      setMicError("無法開啟麥克風。請確認已允許麥克風權限。");
      throw e;
    }
  };

  const takePhoto = () => {
    setCamError("");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPhotoDataUrl(dataUrl);
  };

  const retakePhoto = () => setPhotoDataUrl(null);

  const startAudioRecording = async () => {
    setMicError("");
    const stream = await ensureMicStream();

    if (!window.MediaRecorder) {
      setMicError("此瀏覽器不支援錄音（MediaRecorder）。建議使用 Chrome。");
      return;
    }

    audioChunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (evt) => {
      if (evt.data && evt.data.size > 0) audioChunksRef.current.push(evt.data);
    };

    mr.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      setAudioBlob(blob);

      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    };

    mr.start();
    setIsRecordingAudio(true);
  };

  const stopAudioRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    setIsRecordingAudio(false);
  };

  const resetAudio = () => {
    setIsRecordingAudio(false);
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
  };

  const handleSubmit = async () => {
    if (!photoDataUrl || !audioBlob) return;

    const photoBlob = await (await fetch(photoDataUrl)).blob();

    const formData = new FormData();
    formData.append("photo", photoBlob, "evidence.jpg");
    formData.append("audio", audioBlob, "evidence_audio.webm");

    onSubmitEvidence?.(formData);
  };

  return (
    <div className="flex flex-col md:flex-row w-full h-full gap-8">
      {/* LEFT */}
      <div className="flex-1 flex flex-col justify-center space-y-4">
        <h2 className="text-3xl font-bold text-slate-800">請拍照＋錄音存證</h2>

        <p className="text-lg text-slate-600">
          1) 先拍照：請手拿商品，讓「人＋商品」同框清楚可見
          <br />
          2) 再錄音：對著麥克風清楚說出：
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-800 text-lg">
          「我是 XXX，我買了一個 XX 和一個 XXX」
        </div>

        <p className="text-sm text-slate-500">
          為保障雙方權益，存證僅用於對帳與核對；店家不會任意對外公開。
        </p>

        {/* ACTIONS */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* photo */}
          {photoDataUrl ? (
            <button
              onClick={retakePhoto}
              disabled={isSavingEvidence}
              className="px-6 py-4 rounded-2xl bg-slate-200 text-slate-700 text-lg font-semibold shadow-md hover:bg-slate-300 disabled:bg-slate-200 disabled:text-slate-400"
            >
              🔄 重拍照片
            </button>
          ) : (
            <button
              onClick={takePhoto}
              disabled={isSavingEvidence}
              className="px-6 py-4 rounded-2xl bg-green-600 text-white text-lg font-bold shadow-lg hover:bg-green-500 active:scale-95 transition-transform disabled:bg-slate-300 disabled:text-slate-600"
            >
              📸 拍照
            </button>
          )}

          {/* audio */}
          {isRecordingAudio ? (
            <button
              onClick={stopAudioRecording}
              disabled={isSavingEvidence}
              className="px-6 py-4 rounded-2xl bg-red-600 text-white text-lg font-bold shadow-lg hover:bg-red-500 active:scale-95 transition-transform disabled:bg-slate-300 disabled:text-slate-600"
            >
              ⏹ 停止錄音
            </button>
          ) : audioBlob ? (
            <button
              onClick={resetAudio}
              disabled={isSavingEvidence}
              className="px-6 py-4 rounded-2xl bg-slate-200 text-slate-700 text-lg font-semibold shadow-md hover:bg-slate-300 disabled:bg-slate-200 disabled:text-slate-400"
            >
              🔄 重錄音
            </button>
          ) : (
            <button
              onClick={startAudioRecording}
              disabled={isSavingEvidence}
              className="px-6 py-4 rounded-2xl bg-green-600 text-white text-lg font-bold shadow-lg hover:bg-green-500 active:scale-95 transition-transform disabled:bg-slate-300 disabled:text-slate-600"
            >
              🎙 開始錄音
            </button>
          )}
        </div>

        {/* submit/back */}
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`px-8 py-4 rounded-2xl text-lg font-bold shadow-lg transition-transform ${
              canSubmit
                ? "bg-green-600 text-white hover:bg-green-500 hover:scale-105 active:scale-95"
                : "bg-slate-300 text-slate-600 cursor-not-allowed"
            }`}
          >
            {isSavingEvidence ? "後端存檔中（模擬）..." : "✅ 送出存證"}
          </button>

          <button
            onClick={onBackPayment}
            disabled={isSavingEvidence || isRecordingAudio}
            className="px-6 py-4 rounded-2xl bg-slate-200 text-slate-700 text-lg font-semibold shadow-md hover:bg-slate-300 disabled:bg-slate-200 disabled:text-slate-400"
          >
            ⬅ 返回支付方式
          </button>
        </div>

        {/* status / errors */}
        {(camError || micError) && (
          <div className="mt-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl px-4 py-3 text-sm">
            {camError && <div>相機：{camError}</div>}
            {micError && <div>麥克風：{micError}</div>}
          </div>
        )}

        <div className="text-xs text-slate-500">
          送出條件：需同時完成「拍照」與「錄音」。
        </div>
      </div>

      {/* RIGHT: preview */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-full max-w-xl aspect-video bg-black rounded-3xl shadow-2xl overflow-hidden border-4 border-slate-800">
          {/* top labels */}
          <div className="absolute top-4 left-4 text-xs font-mono text-green-300 bg-black/60 px-3 py-1 rounded-full">
            EVIDENCE PHOTO
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full">
            <div
              className={`w-3 h-3 rounded-full ${
                isRecordingAudio ? "bg-red-500 animate-pulse" : "bg-slate-300"
              }`}
            />
            <span className="text-xs text-white tracking-widest font-semibold">
              {isRecordingAudio ? "AUDIO REC" : isSavingEvidence ? "SAVING" : "STANDBY"}
            </span>
          </div>

          {/* content */}
          <div className="w-full h-full">
            {photoDataUrl ? (
              <img src={photoDataUrl} alt="evidence" className="w-full h-full object-cover" />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover opacity-95"
              />
            )}
          </div>

          {/* bottom hint */}
          <div className="absolute inset-x-0 bottom-6 flex justify-center">
            <div className="bg-black/60 text-slate-100 px-6 py-3 rounded-2xl text-sm">
              {photoDataUrl
                ? "已拍照。請完成錄音後送出存證。"
                : "請調整角度：人＋商品同框清楚可見，再按「拍照」。"}
            </div>
          </div>

          {/* audio playback */}
          {audioUrl && (
            <div className="absolute left-6 bottom-6 translate-y-[72px] w-[calc(100%-48px)]">
              <div className="bg-slate-900/80 rounded-2xl px-4 py-3">
                <div className="text-xs text-slate-200 mb-2">錄音預覽</div>
                <audio controls src={audioUrl} className="w-full" />
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>
    </div>
  );
}

export default StepEvidenceRecord;

import React, { useEffect, useRef, useState } from "react";

function CameraView({
  label = "CAMERA",
  status = "LIVE",
  children,
  videoRef: externalVideoRef,
  onReadyChange,
  onErrorChange,
}) {
  const internalVideoRef = useRef(null);
  const videoRef = externalVideoRef || internalVideoRef;

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream;

    async function start() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          const msg = "此瀏覽器不支援相機存取（需 HTTPS 或 localhost）。";
          setError(msg);
          onErrorChange?.(msg);
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setReady(true);
          onReadyChange?.(true);
        }
      } catch (err) {
        let msg = "無法啟動相機，請檢查權限或裝置。";
        if (
          err &&
          (err.name === "NotAllowedError" ||
            err.name === "PermissionDeniedError")
        ) {
          msg = "相機權限被拒絕，請在網址列授權或改用 HTTPS / localhost。";
        } else if (err && err.name === "NotFoundError") {
          msg = "找不到可用攝影機裝置。";
        }

        setError(msg);
        onErrorChange?.(msg);
        onReadyChange?.(false);
      }
    }

    start();

    return () => {
      onReadyChange?.(false);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [onErrorChange, onReadyChange, videoRef]);

  return (
    <div className="relative w-full max-w-xl aspect-video bg-black rounded-3xl shadow-2xl overflow-hidden border-4 border-slate-800">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      <div className="absolute top-4 left-4 text-xs font-mono text-green-300 bg-black/60 px-3 py-1 rounded-full">
        {label}
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full">
        <div
          className={`w-3 h-3 rounded-full ${
            status === "REC" || status === "SCANNING"
              ? "bg-red-500 animate-pulse"
              : "bg-slate-300"
          }`}
        />
        <span className="text-xs text-white tracking-widest font-semibold">
          {status}
        </span>
      </div>

      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-slate-100">
          <div className="text-5xl mb-2">📷</div>
          <div className="text-lg mb-1">正在啟動相機...</div>
          <div className="text-xs text-slate-300">
            若長時間無法顯示，請檢查相機權限或改用 HTTPS / localhost。
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-red-200 text-center px-4">
          <div className="text-4xl mb-2">⚠️</div>
          <div className="text-sm whitespace-pre-line">{error}</div>
        </div>
      )}

      {children && (
        <div className="absolute inset-0 pointer-events-none">{children}</div>
      )}
    </div>
  );
}

export default CameraView;

import React, { useEffect, useRef, useState } from "react";

function CameraView({
  label = "CAMERA",
  status = "LIVE",
  mode = "external", // ⭐ external | internal
  fill = false, // ⭐ true 時填滿父層（不設 max-w-xl）
  bare = false, // true 時不畫外框與 label/status 標籤，由父層自己包框
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

    async function startInternalCamera() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");

      if (cameras.length === 0) throw new Error("No camera");

      // ⭐ 通常 index 0 是內建鏡頭
      const cam = cameras[0];

      return navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cam.deviceId } },
        audio: false,
      });
    }

    async function startExternalCamera() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");

      if (cameras.length === 0) throw new Error("No camera");

      // ⭐ 通常最後一個是外接鏡頭
      const cam = cameras[cameras.length - 1];

      return navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cam.deviceId } },
        audio: false,
      });
    }

    async function start() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          const msg = "此瀏覽器不支援相機存取（需 HTTPS 或 localhost）。";
          setError(msg);
          onErrorChange?.(msg);
          return;
        }

        // ⭐ 先取得權限
        const temp = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        temp.getTracks().forEach((t) => t.stop());

        // ⭐ 根據 mode 選鏡頭
        if (mode === "internal") {
          stream = await startInternalCamera();
        } else {
          stream = await startExternalCamera();
        }

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
  }, [mode, onErrorChange, onReadyChange, videoRef]);

  return (
    <div
      className={
        bare
          ? "relative w-full h-full overflow-hidden"
          : fill
          ? "relative w-full h-full bg-cocoa overflow-hidden"
          : "relative w-full max-w-xl aspect-video bg-cocoa rounded-[22px] overflow-hidden border-[3px] border-ink"
      }
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {!bare && (
        <>
          <div className="absolute top-4 left-4 text-xs font-mono text-moss bg-cocoa/70 px-3 py-1 rounded-full">
            {label}
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2 bg-cocoa/70 px-4 py-2 rounded-full">
            <div
              className={`w-3 h-3 rounded-full ${
                status === "REC" || status === "SCANNING"
                  ? "bg-peach animate-pulse"
                  : "bg-sand"
              }`}
            />
            <span className="text-xs text-cream tracking-widest font-semibold">
              {status}
            </span>
          </div>
        </>
      )}

      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-cocoa text-cream">
          <div className="text-lg mb-1">正在啟動相機...</div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 bg-cocoa text-peach">
          <div className="text-lg whitespace-pre-line">{error}</div>
        </div>
      )}

      {children && (
        <div className="absolute inset-0 pointer-events-none">{children}</div>
      )}
    </div>
  );
}

export default CameraView;
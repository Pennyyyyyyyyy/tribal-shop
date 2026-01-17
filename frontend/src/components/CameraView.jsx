// src/components/CameraView.jsx
import React, { useEffect, useRef, useState } from 'react';

/**
 * CameraView
 * - 掛載時呼叫 getUserMedia 開啟相機
 * - 將 stream 接到 <video> 上顯示畫面
 * - 卸載時停止所有 tracks（避免相機一直被佔用）
 *
 * props:
 *  - label: 左上角小標
 *  - status: 右上角狀態文字（例如 "LIVE" / "SCANNING..." / "REC"）
 *  - children: 底下可疊加自訂 overlay（例如「辨識中」文字）
 */

function CameraView({ label = 'CAMERA', status = 'LIVE', children }) {
  const videoRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('此瀏覽器不支援相機存取（需要 HTTPS 或新版瀏覽器）。');
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
        }
      } catch (err) {
        console.error('無法開啟相機：', err);

        // 1. 使用者拒絕或瀏覽器封鎖
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('相機權限被拒絕或封鎖。');

          // 額外跳出自己的提示，教使用者去哪裡開啟
          window.alert(
            '目前無法使用相機，請檢查下列項目：\n\n' +
            '1. 請確認網址是 https:// 或 http://localhost 開頭。\n' +
            '2. 在網址列右邊點相機圖示，將「相機」權限改成「允許」，然後重新整理頁面。\n' +
            '3. 或到 chrome://settings/content/camera 檢查是否被封鎖。'
          );
        } else if (err.name === 'NotFoundError') {
          setError('找不到任何可用的攝影機裝置。');
        } else {
          setError('無法開啟相機，請確認瀏覽器權限或裝置狀態。');
        }
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="relative w-full max-w-xl aspect-video bg-black rounded-3xl shadow-2xl overflow-hidden border-4 border-slate-800">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* 左上角標籤 */}
      <div className="absolute top-4 left-4 text-xs font-mono text-green-300 bg-black/60 px-3 py-1 rounded-full">
        {label}
      </div>

      {/* 右上角狀態 */}
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full">
        <div
          className={`w-3 h-3 rounded-full ${
            status === 'REC' || status === 'SCANNING'
              ? 'bg-red-500 animate-pulse'
              : 'bg-slate-300'
          }`}
        />
        <span className="text-xs text-white tracking-widest font-semibold">
          {status}
        </span>
      </div>

      {/* 還沒 ready 時的覆蓋層 */}
      {!cameraReady && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-slate-100">
          <div className="text-5xl mb-2">📷</div>
          <div className="text-lg mb-1">正在啟動相機...</div>
          <div className="text-xs text-slate-300">
            若長時間無法顯示，請檢查相機權限或改用 HTTPS / localhost。
          </div>
        </div>
      )}

      {/* 發生錯誤時的說明 */}
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

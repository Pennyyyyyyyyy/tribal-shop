// src/components/CheckoutApp.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "./Header";

const API_BASE_URL =
  import.meta?.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const MOCK_ITEMS = [
  { id: 1, name: "蘋果", price: 30, image: "🍎" },
  { id: 2, name: "香蕉", price: 25, image: "🍌" },
  { id: 3, name: "沙拉油", price: 120, image: "🧴" },
  { id: 4, name: "蘋果汁", price: 30, image: "🧃" },
  { id: 5, name: "手工餅乾", price: 50, image: "🍪" },
];

const STEP = {
  WELCOME: 1,
  AUTH: 2,
  INSTRUCTION: 3,
  SCAN: 4,
  CART: 5,
  PAYMENT: 6,
  EVIDENCE_PHOTO: 7,
  END: 8,
};

const TOTAL_STEPS = 8;

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
          (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
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
          className={`w-3 h-3 rounded-full ${status === "REC" || status === "SCANNING"
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

const isE2E =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("e2e") === "true";

function CheckoutApp() {
  const [currentStep, setCurrentStep] = useState(STEP.WELCOME);
  const [isTribalMember, setIsTribalMember] = useState(false);

  const [cart, setCart] = useState([]);
  const [currentItem, setCurrentItem] = useState(null);
  const [products, setProducts] = useState(MOCK_ITEMS);
  const [apiError, setApiError] = useState("");

  const [scanPhase, setScanPhase] = useState("IDLE"); // IDLE | SCANNING | RESULT
  const [scannedItem, setScannedItem] = useState(null);
  const [lastAddedItem, setLastAddedItem] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState(null);
  const [authPassword, setAuthPassword] = useState("");
  const [authErrorMsg, setAuthErrorMsg] = useState("");
  const [authErrorCount, setAuthErrorCount] = useState(0);
  const [authLocked, setAuthLocked] = useState(false);

  const evidenceVideoRef = useRef(null);
  const evidenceCanvasRef = useRef(null);

  const [camReady, setCamReady] = useState(false);
  const [camErr, setCamErr] = useState("");

  const [evidenceSnapshot, setEvidenceSnapshot] = useState(null);
  const [isSavingEvidence, setIsSavingEvidence] = useState(false);

  const scanVideoRef = useRef(null);

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/products`);
        if (response.ok) {
          const data = await response.json();
          setProducts(data.products || MOCK_ITEMS);
          setApiError("");
        } else {
          setApiError("後端連接失敗，使用本地資料");
        }
      } catch (error) {
        console.warn("後端連接失敗，使用本地 mock 資料:", error);
        setApiError("後端暫未連接，使用本地模擬資料");
      }
    })();
  }, []);

  useEffect(() => {
    if (currentStep === STEP.INSTRUCTION) {
      const timer = setTimeout(() => {
        setCurrentStep(STEP.SCAN);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const doScan = async () => {
    setScanPhase("SCANNING");
    setScannedItem(null);

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

        const formData = new FormData();
        formData.append("image", blob, "frame.jpg");

        const resp = await fetch(`${API_BASE_URL}/vision/detect-product`, {
          method: "POST",
          body: formData,
        });
        const data = await resp.json();

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

  const addItemToCart = (item) => {
    if (!item) return;
    setCart((prev) => {
      const index = prev.findIndex((p) => p.id === item.id);
      if (index === -1) return [...prev, item];
      const newCart = [...prev];
      newCart[index] = {
        ...newCart[index],
        quantity: newCart[index].quantity + item.quantity,
      };
      return newCart;
    });
  };

  const increaseQty = (id) => {
    setCart((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, quantity: it.quantity + 1 } : it
      )
    );
  };

  const decreaseQty = (id) => {
    setCart((prev) => {
      const target = prev.find((it) => it.id === id);
      if (!target) return prev;
      if (target.quantity <= 1) return prev.filter((it) => it.id !== id);

      return prev.map((it) =>
        it.id === id ? { ...it, quantity: it.quantity - 1 } : it
      );
    });
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

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const resetEvidence = () => {
    setCamErr("");
    setIsSavingEvidence(false);
    setEvidenceSnapshot(null);
  };

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
    if (!evidenceSnapshot || isSavingEvidence) {
      return;
    }

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

      setCurrentStep(STEP.END);
    } catch (error) {
      console.error("上傳存證出錯:", error);
      alert("上傳存證失敗，請重試");
    } finally {
      setIsSavingEvidence(false);
    }
  };

  const handleAuthConfirm = () => {
    if (authLocked) return;

    const CORRECT_PASSWORD = "1234";
    if (authPassword === CORRECT_PASSWORD) {
      setAuthErrorMsg("");
      setAuthErrorCount(0);
      setAuthLocked(false);
      setCurrentStep(STEP.INSTRUCTION);
    } else {
      const newCount = authErrorCount + 1;
      setAuthErrorCount(newCount);
      setAuthPassword("");

      if (newCount >= 3) {
        setAuthLocked(true);
        setAuthErrorMsg(
          "輸入錯誤已達 3 次，系統暫時鎖定，請改用其他支付方式或請店長協助。"
        );
      } else {
        setAuthErrorMsg(`通關密碼錯誤，第 ${newCount} 次，請再試一次。`);
      }
    }
  };

  const handleFinalSubmit = () => {
    console.log("評分：", rating, "回饋：", feedback);
    console.log("購物車內容：", cart);

    resetEvidence();

    setCurrentStep(STEP.WELCOME);
    setCart([]);
    setCurrentItem(null);
    setPaymentMethod(null);
    setAuthPassword("");
    setAuthErrorMsg("");
    setAuthErrorCount(0);
    setAuthLocked(false);
    setRating(0);
    setFeedback("");
    setIsTribalMember(false);
    setScanPhase("IDLE");
    setScannedItem(null);
    setLastAddedItem(null);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case STEP.WELCOME:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
            <div className="text-6xl mb-2">👋</div>
            <h2 className="text-4xl font-bold text-slate-800">Welcome!</h2>
            <p className="text-xl text-slate-600">
              歡迎來到部落誠實商店自助結帳系統
            </p>

            <div className="flex flex-col md:flex-row gap-6 mt-6">
              <button
                data-testid="btn-guest"
                onClick={() => {
                  setIsTribalMember(false);
                  setCurrentStep(STEP.INSTRUCTION);
                }}
                className="px-10 py-5 rounded-2xl bg-green-600 hover:bg-green-500 text-white text-2xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                遊客
              </button>

              <button
                data-testid="btn-tribal"
                onClick={() => {
                  setIsTribalMember(true);
                  setCurrentStep(STEP.AUTH);
                }}
                className="px-10 py-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-2xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                族人
              </button>
            </div>
          </div>
        );

      case STEP.AUTH: {
        const authBackStep = STEP.WELCOME;

        const onPressDigit = (d) => {
          if (authLocked) return;
          if (authPassword.length >= 4) return;
          setAuthPassword((prev) => prev + d);
        };

        const onClear = () => {
          if (authLocked) return;
          setAuthPassword("");
        };

        return (
          <div className="w-full h-full relative">
            <button
              type="button"
              onClick={() => setCurrentStep(authBackStep)}
              className="absolute top-6 left-6 text-slate-600 hover:text-slate-900"
            >
              ← 返回首頁
            </button>

            <div className="flex-1 flex items-center justify-center h-full">
              <div className="w-full max-w-xl flex flex-col items-center gap-6 px-6">
                <h2 className="text-4xl font-black text-center text-slate-900">
                  賒帳身份驗證
                </h2>

                <p className="text-slate-600 text-center">
                  請輸入密碼完成身份確認。
                </p>

                <div className="grid grid-cols-5 gap-4 w-full">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((n) => (
                    <button
                      key={n}
                      type="button"
                      data-testid={`keypad-${n}`}
                      onClick={() => onPressDigit(n)}
                      disabled={authLocked}
                      className={`h-16 rounded-2xl shadow text-xl font-semibold transition ${authLocked
                        ? "bg-slate-200 cursor-not-allowed"
                        : "bg-white hover:bg-slate-100 active:scale-95"
                        }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <div className="w-full">
                  <div className="text-slate-700 font-semibold mb-2">輸入的密碼</div>
                  <input
                    value={"●".repeat(authPassword.length)}
                    readOnly
                    className="w-full h-14 rounded-2xl border border-slate-200 bg-white px-4 text-lg"
                    placeholder="請輸入密碼"
                  />
                </div>

                {authErrorMsg && (
                  <div className="w-full rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-rose-700">
                    {authErrorMsg}
                  </div>
                )}

                <div className="flex items-center gap-4 w-full">
                  <button
                    type="button"
                    data-testid="btn-clear"
                    onClick={onClear}
                    disabled={authLocked}
                    className={`flex-1 h-14 rounded-2xl shadow font-semibold transition ${authLocked
                      ? "bg-slate-200 cursor-not-allowed"
                      : "bg-white hover:bg-slate-100"
                      }`}
                  >
                    清除
                  </button>

                  <button
                    type="button"
                    data-testid="btn-confirm"
                    onClick={handleAuthConfirm}
                    disabled={authLocked || authPassword.length < 4}
                    className={`flex-1 h-14 rounded-2xl shadow font-semibold text-white transition ${authLocked || authPassword.length < 4
                      ? "bg-emerald-300 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                  >
                    確認
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case STEP.INSTRUCTION:
        return (
          <div className="flex flex-col md:flex-row gap-8 w-full h-full">
            <div className="flex-1 flex flex-col justify-center space-y-6">
              <h2 className="text-3xl font-bold text-slate-800">
                請將物品拿到鏡頭前
              </h2>
              <p className="text-xl text-slate-600">
                依照螢幕上的指示動作，在尚未辨識完成前請勿離開。
              </p>
              <p className="text-lg text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                系統將自動啟動鏡頭並嘗試辨識您的商品，約需 3 秒鐘，請稍候。
              </p>
              <p className="text-sm text-slate-400">
                系統已連接 AI 影像辨識引擎
              </p>
            </div>

            <div className="flex-1 flex items-center justify-center">
              <div className="relative w-full max-w-xl aspect-video bg-black rounded-3xl shadow-2xl overflow-hidden border-4 border-slate-800">
                <div className="absolute top-4 left-4 text-xs font-mono text-green-300 bg-black/60 px-3 py-1 rounded-full">
                  CAMERA 01 · FRONT
                </div>
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-white tracking-widest font-semibold">
                    LIVE
                  </span>
                </div>
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-slate-100">
                    <div className="text-6xl mb-4">📷</div>
                    <div className="text-xl">正在準備鏡頭與辨識系統...</div>
                    <div className="mt-2 text-sm text-slate-300">
                      約 3 秒後進入「辨識中」畫面
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case STEP.SCAN: {
        return (
          <div className="w-full h-full flex flex-col">
            <div className="flex flex-col md:flex-row gap-8 w-full flex-1 min-h-0">
              {/* 左側：辨識結果 / 提示 */}
              <div className="flex-1 flex flex-col justify-center space-y-4">
                {scanPhase === "RESULT" && scannedItem ? (
                  <>
                    <h2 className="text-3xl font-bold text-slate-800">
                      辨識結果
                    </h2>

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
                          ✅ 加入購物車
                        </button>
                        <button
                          data-testid="btn-reject-item"
                          onClick={handleRejectScanned}
                          className="w-full px-5 py-4 rounded-2xl bg-slate-200 text-slate-800 font-semibold text-lg hover:bg-slate-300 shadow-md transition-transform hover:scale-105 active:scale-95"
                        >
                          ↩️ 重新掃描
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
                        <div className="text-2xl">{lastAddedItem.image || "📦"}</div>
                        <div className="text-sm text-emerald-800">
                          已加入：<span className="font-bold">{lastAddedItem.name}</span> ${lastAddedItem.price}
                        </div>
                      </div>
                    )}
                  </>
                )}
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
                        <div className="text-2xl mb-2">🔍 辨識中...</div>
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
                  {scanPhase === "SCANNING" ? "辨識中..." : "📸 拍照辨識"}
                </button>
              </div>
            </div>

            {/* 底部：購物車狀態列 */}
            <div className="mt-4 bg-white rounded-2xl border border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="text-slate-700">
                  <span className="text-sm text-slate-500">購物車</span>
                  <span className="text-xl font-bold ml-2">
                    {cart.length} 項 · ${totalAmount}
                  </span>
                </div>
                <button
                  data-testid="btn-view-cart"
                  onClick={() => setCurrentStep(STEP.CART)}
                  className="px-6 py-3 rounded-2xl bg-sky-600 text-white font-bold text-lg hover:bg-sky-500 shadow-lg transition-transform hover:scale-105 active:scale-95"
                >
                  🛒 查看清單
                </button>
              </div>
            </div>
          </div>
        );
      }

      case STEP.CART:
        return (
          <div className="flex flex-col w-full h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-3xl font-bold text-slate-800">購物車清單</h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCurrentStep(STEP.SCAN)}
                  className="px-4 py-2 rounded-xl bg-sky-100 text-sky-800 text-sm font-semibold hover:bg-sky-200"
                >
                  ➕ 繼續辨識商品
                </button>
              )}
            </div>

            <div className="flex-1 bg-white rounded-3xl shadow-inner border border-slate-100 p-6 overflow-auto">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
                  <div className="text-5xl">🛒</div>
                  <div className="text-lg">目前購物車是空的，請先辨識商品。</div>
                  <button
                    onClick={() => setCurrentStep(STEP.SCAN)}
                    className="mt-2 px-6 py-3 rounded-2xl bg-green-600 text-white font-semibold hover:bg-green-500 shadow-md"
                  >
                    開始辨識商品
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-4 border border-slate-100"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="text-3xl shrink-0">{item.image}</div>
                        <div className="min-w-0">
                          <div className="text-lg font-semibold text-slate-800 truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-500">單價：${item.price}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => decreaseQty(item.id)}
                          className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 text-2xl font-bold shadow-sm hover:bg-slate-100 active:scale-95 transition"
                          aria-label="減少數量"
                        >
                          −
                        </button>

                        <div className="w-16 text-center">
                          <div className="text-xs text-slate-500">數量</div>
                          <div className="text-2xl font-bold text-slate-800">
                            {item.quantity}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => increaseQty(item.id)}
                          className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 text-2xl font-bold shadow-sm hover:bg-slate-100 active:scale-95 transition"
                          aria-label="增加數量"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right w-28">
                        <div className="text-lg font-bold text-green-700">
                          ${item.price * item.quantity}
                        </div>
                        <div className="text-xs text-slate-400">小計</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <div className="text-right flex flex-col items-end gap-4">
                <div className="text-[27.2px] font-bold text-slate-800">
                  <span className="text-slate-800">總金額：</span>
                  <span className="text-green-700">${totalAmount}</span>
                </div>

                <div className="flex gap-4">
                  <button
                    data-testid="btn-checkout"
                    disabled={cart.length === 0}
                    onClick={() => {
                      setCurrentStep(
                        isTribalMember ? STEP.EVIDENCE_PHOTO : STEP.PAYMENT
                      );
                    }}
                    className={`px-10 py-5 rounded-2xl text-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 whitespace-nowrap ${cart.length === 0
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                      : "bg-sky-600 text-white hover:bg-sky-500"
                      }`}
                  >
                    🛒 結帳
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case STEP.PAYMENT:
        return isTribalMember ? (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
            <h2 className="text-3xl font-bold text-slate-800">結帳</h2>
            <p className="text-lg text-slate-600">
              你目前選的是「族人」，請使用賒帳流程結帳。
            </p>
            <div className="flex flex-col md:flex-row gap-4">
              <button
                onClick={() => setCurrentStep(STEP.AUTH)}
                className="px-10 py-5 rounded-2xl bg-slate-800 text-white text-xl font-bold shadow-lg hover:bg-slate-700 transition-transform hover:scale-105 active:scale-95"
              >
                📘 前往賒帳驗證
              </button>
              <button
                onClick={() => setCurrentStep(STEP.CART)}
                className="px-10 py-5 rounded-2xl bg-slate-100 text-slate-700 text-xl font-bold shadow-md hover:bg-slate-200"
              >
                ⬅ 返回購物車
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full space-y-8 text-center">
            <h2 className="text-3xl font-bold text-slate-800">Line Pay 結帳</h2>
            <p className="text-lg text-slate-600">
              本次消費金額：
              <span className="text-2xl text-green-700 font-semibold">
                ${totalAmount}
              </span>
            </p>

            <button
              data-testid="btn-linepay"
              onClick={() => {
                setPaymentMethod("Linepay");
                alert("模擬：已轉 Linepay Money 給飛鼠");
                setCurrentStep(STEP.END);
              }}
              className="px-10 py-5 rounded-2xl bg-emerald-600 text-white text-xl font-bold shadow-lg hover:bg-emerald-500 transition-transform hover:scale-105 active:scale-95"
            >
              LinePay 付款
            </button>

            <button
              onClick={() => setCurrentStep(STEP.CART)}
              className="mt-4 text-slate-500 underline text-sm"
            >
              ⬅ 返回購物車
            </button>
          </div>
        );

      case STEP.EVIDENCE_PHOTO:
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
                    className={`flex-1 px-6 py-4 rounded-2xl text-lg font-bold shadow-lg transition-transform ${!camReady || isSavingEvidence
                      ? "bg-slate-300 text-slate-600 cursor-not-allowed"
                      : "bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 active:scale-95"
                      }`}
                  >
                    📸 拍照
                  </button>
                )}

                <button
                  onClick={() => {
                    resetEvidence();
                    setCurrentStep(STEP.CART);
                  }}
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
                className={`w-full px-6 py-4 rounded-2xl text-xl font-bold shadow-lg transition-transform ${!evidenceSnapshot || isSavingEvidence
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

      case STEP.END:
        return (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
            <div className="text-6xl mb-2">🎉</div>
            <h2 className="text-3xl font-bold text-green-700">Thank you!</h2>
            <p className="text-lg text-slate-600 max-w-xl">
              感謝您的使用，商家會再確認存貨與消費內容。如有問題，店家會主動與您聯繫。
            </p>

            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 px-8 py-6 w-full max-w-2xl mt-4 text-left">
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                今日的自助結帳體驗如何？
              </h3>

              <div className="flex items-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`text-3xl ${rating >= star ? "text-yellow-400" : "text-slate-300"
                      }`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-2 text-sm text-slate-500">
                  {rating > 0 ? `已給予 ${rating} 分` : "請點選星星評分"}
                </span>
              </div>

              <label className="block text-slate-700 mb-2 font-semibold">
                想說的話（選填）
              </label>

              <textarea
                rows={4}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="例如：哪裡使用順、哪裡可以改進，或想跟店長說的話。"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />

              <button
                data-testid="btn-final-submit"
                onClick={handleFinalSubmit}
                className="mt-4 w-full px-6 py-4 rounded-2xl bg-green-600 text-white text-xl font-bold shadow-lg hover:bg-green-500 transition-transform hover:scale-105 active:scale-95"
              >
                ✅ 送出並回到首頁
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        cartCount={cartCount}
        totalAmount={totalAmount}
      />

      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-6xl h-[70vh] md:h-[75vh] bg-slate-50 rounded-3xl shadow-2xl border border-slate-200 p-6 md:p-8">
          {renderStepContent()}
        </div>
      </main>
    </div>
  );
}

export default CheckoutApp;

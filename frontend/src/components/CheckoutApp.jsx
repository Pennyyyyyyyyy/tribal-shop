// src/components/CheckoutApp.jsx
import React, { useState, useEffect, useRef } from 'react';
import Header from './Header';

// Step components
import StepWelcome from './steps/StepWelcome';
import StepInstruction from './steps/StepInstruction';
import StepScanning from './steps/StepScanning';
import StepCart from './steps/StepCart';
import StepPaymentMethod from './steps/StepPaymentMethod';
import StepAuth from './steps/StepAuth';
import StepEvidenceRecord from './steps/StepEvidenceRecord';
import StepEvidenceConfirm from './steps/StepEvidenceConfirm';
import StepEnd from './steps/StepEnd';

console.log('[CheckoutApp] A version loaded');

// Mock 商品資料
const MOCK_ITEMS = [
  { id: 1, name: '蘋果', price: 30, image: '🍎' },
  { id: 2, name: '香蕉', price: 25, image: '🍌' },
  { id: 3, name: '沙拉油', price: 120, image: '🧴' },
  { id: 4, name: '白米 1kg', price: 85, image: '🍚' },
  { id: 5, name: '餅乾', price: 50, image: '🍪' },
];

// —— A：合併「辨識」+「確認」到同一頁（Step 3），只有低信心才需要確認 ——
// 你可以調整這個門檻：越高 = 越常跳確認；越低 = 越常自動加入
const CONFIRM_THRESHOLD = 0.78;

function getRandomMockItem() {
  const base = MOCK_ITEMS[Math.floor(Math.random() * MOCK_ITEMS.length)];

  // 模擬辨識信心度：0.55 ~ 0.98
  const confidence = Math.round((0.55 + Math.random() * 0.43) * 100) / 100;

  return { ...base, quantity: 1, confidence };
}

const STEP = {
  WELCOME: 1,
  INSTRUCTION: 2,
  SCAN: 3, // A：掃描頁內建確認卡（取代原本 StepItemConfirm）
  CART: 4,
  PAYMENT: 5,
  AUTH: 6,
  EVIDENCE_RECORD: 7,
  EVIDENCE_CONFIRM: 8,
  END: 9,
};

const TOTAL_STEPS = 9;

function CheckoutApp() {
  const [currentStep, setCurrentStep] = useState(STEP.WELCOME);

  // 購物車
  const [cart, setCart] = useState([]);

  // A：掃描頁狀態（同頁顯示：辨識中 / 自動加入提示 / 需要確認）
  const [scanNonce, setScanNonce] = useState(0); // 用來觸發下一輪掃描
  const [scanPhase, setScanPhase] = useState('SCANNING'); // SCANNING | CONFIRM | AUTO_ADDED
  const [pendingItem, setPendingItem] = useState(null); // 低信心時要確認的 item
  const [lastAddedItem, setLastAddedItem] = useState(null); // 顯示「已加入」提示用

  const scanMainTimerRef = useRef(null);
  const scanLoopTimerRef = useRef(null);

  // 支付 / 賒帳
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authErrorMsg, setAuthErrorMsg] = useState('');
  const [authErrorCount, setAuthErrorCount] = useState(0);
  const [authLocked, setAuthLocked] = useState(false);

  // 存證：拍照 + 錄音（父層只管「存檔中」與確認頁預覽）
  const [isSavingEvidence, setIsSavingEvidence] = useState(false);
  const [evidenceSnapshot, setEvidenceSnapshot] = useState(null);
  const [evidenceAudioUrl, setEvidenceAudioUrl] = useState(null);

  // 評分 / 回饋
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  // Step 2: 3 秒後自動進 Step 3（掃描頁）
  useEffect(() => {
    if (currentStep === STEP.INSTRUCTION) {
      const timer = setTimeout(() => setCurrentStep(STEP.SCAN), 3000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // 共用：加入商品到購物車（同商品則數量+1）
  const addItemToCart = (item) => {
    if (!item) return;
    setCart((prev) => {
      const index = prev.findIndex((p) => p.id === item.id);
      if (index === -1) return [...prev, item];

      const newCart = [...prev];
      newCart[index] = { ...newCart[index], quantity: newCart[index].quantity + item.quantity };
      return newCart;
    });
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // A：掃描循環（進入掃描頁後：辨識中 → (高信心自動加入) 或 (低信心要求確認)）
  useEffect(() => {
    // 只在掃描頁跑
    if (currentStep !== STEP.SCAN) return;

    // 清掉舊 timer
    if (scanMainTimerRef.current) clearTimeout(scanMainTimerRef.current);
    if (scanLoopTimerRef.current) clearTimeout(scanLoopTimerRef.current);

    setScanPhase('SCANNING');
    setPendingItem(null);

    // 模擬：1.2 秒後得到辨識結果
    scanMainTimerRef.current = setTimeout(() => {
      const item = getRandomMockItem();

      if (item.confidence >= CONFIRM_THRESHOLD) {
        // 高信心：自動加入
        addItemToCart(item);
        setLastAddedItem(item);
        setScanPhase('AUTO_ADDED');

        // 0.9 秒後自動進下一輪掃描
        scanLoopTimerRef.current = setTimeout(() => {
          setScanNonce((n) => n + 1);
        }, 900);
      } else {
        // 低信心：同頁顯示確認卡
        setPendingItem(item);
        setScanPhase('CONFIRM');
      }
    }, 1200);

    return () => {
      if (scanMainTimerRef.current) clearTimeout(scanMainTimerRef.current);
      if (scanLoopTimerRef.current) clearTimeout(scanLoopTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, scanNonce]);

  const restartScan = () => setScanNonce((n) => n + 1);

  const handleConfirmPending = () => {
    if (!pendingItem) return;

    // 確認為正確：加入 → 顯示已加入提示 → 下一輪掃描
    addItemToCart(pendingItem);
    setLastAddedItem(pendingItem);
    setPendingItem(null);
    setScanPhase('AUTO_ADDED');

    if (scanLoopTimerRef.current) clearTimeout(scanLoopTimerRef.current);
    scanLoopTimerRef.current = setTimeout(() => restartScan(), 900);
  };

  const handleRejectPending = () => {
    // 確認為不正確：直接重掃
    setPendingItem(null);
    setLastAddedItem(null);
    restartScan();
  };

  // Step AUTH：確認賒帳密碼
  const handleAuthConfirm = () => {
    if (authLocked) return;
    const CORRECT_PASSWORD = '1234';

    if (authPassword === CORRECT_PASSWORD) {
      setAuthErrorMsg('');
      setAuthErrorCount(0);
      setAuthLocked(false);
      setCurrentStep(STEP.EVIDENCE_RECORD);
    } else {
      const newCount = authErrorCount + 1;
      setAuthErrorCount(newCount);
      setAuthPassword('');

      if (newCount >= 3) {
        setAuthLocked(true);
        setAuthErrorMsg('輸入錯誤已達 3 次，系統暫時鎖定，請改用其他支付方式或請店長協助。');
      } else {
        setAuthErrorMsg(`通關密碼錯誤，第 ${newCount} 次，請再試一次。`);
      }
    }
  };

  const clearEvidenceMedia = () => {
    if (evidenceAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(evidenceAudioUrl);
    if (evidenceSnapshot?.startsWith('blob:')) URL.revokeObjectURL(evidenceSnapshot);
    setEvidenceSnapshot(null);
    setEvidenceAudioUrl(null);
  };

  // Step EVIDENCE_RECORD：送出「拍照 + 錄音」（先做模擬存檔）
  const handleSubmitEvidence = async (formData) => {
    if (isSavingEvidence) return;
    setIsSavingEvidence(true);

    try {
      clearEvidenceMedia();

      const photo = formData.get('photo');
      const audio = formData.get('audio');

      if (photo instanceof Blob) setEvidenceSnapshot(URL.createObjectURL(photo));
      if (audio instanceof Blob) setEvidenceAudioUrl(URL.createObjectURL(audio));

      // 真 API（之後要串再打開）
      // await fetch("http://127.0.0.1:8000/evidence", { method: "POST", body: formData });

      await new Promise((r) => setTimeout(r, 1200));
      setCurrentStep(STEP.EVIDENCE_CONFIRM);
    } finally {
      setIsSavingEvidence(false);
    }
  };

  // Step END：送出評分並重置系統
  const handleFinalSubmit = () => {
    console.log('評分：', rating, '回饋：', feedback);
    console.log('購物車內容：', cart);

    clearEvidenceMedia();

    // reset
    setCurrentStep(STEP.WELCOME);
    setCart([]);

    setPaymentMethod(null);
    setAuthPassword('');
    setAuthErrorMsg('');
    setAuthErrorCount(0);
    setAuthLocked(false);

    setIsSavingEvidence(false);
    setRating(0);
    setFeedback('');

    // 掃描狀態 reset
    setScanNonce(0);
    setScanPhase('SCANNING');
    setPendingItem(null);
    setLastAddedItem(null);
  };

  const renderStep = () => {
    switch (currentStep) {
      case STEP.WELCOME:
        return <StepWelcome onStartCheckout={() => setCurrentStep(STEP.INSTRUCTION)} />;

      case STEP.INSTRUCTION:
        return <StepInstruction />;

      case STEP.SCAN:
        return (
          <StepScanning
            phase={scanPhase}
            pendingItem={pendingItem}
            lastAddedItem={lastAddedItem}
            cartCount={cartCount}
            totalAmount={totalAmount}
            onConfirmItem={handleConfirmPending}
            onRejectItem={handleRejectPending}
            onGoCart={() => setCurrentStep(STEP.CART)}
          />
        );

      case STEP.CART:
        return (
          <StepCart
            cart={cart}
            totalAmount={totalAmount}
            onGoScan={() => setCurrentStep(STEP.SCAN)}
            onCheckout={() => {
              setPaymentMethod(null);
              setCurrentStep(STEP.PAYMENT);
            }}
          />
        );

      case STEP.PAYMENT:
        return (
          <StepPaymentMethod
            totalAmount={totalAmount}
            onBackToCart={() => setCurrentStep(STEP.CART)}
            onPayLinePay={() => {
              setPaymentMethod('Linepay');
              alert('模擬：已轉 Linepay Money 給飛鼠');
              setCurrentStep(STEP.END);
            }}
            onGoCredit={() => {
              setPaymentMethod('Credit');
              setCurrentStep(STEP.AUTH);
            }}
          />
        );

      case STEP.AUTH:
        return (
          <StepAuth
            authPassword={authPassword}
            onChangePassword={setAuthPassword}
            authErrorMsg={authErrorMsg}
            authLocked={authLocked}
            onFillDemoPassword={() => setAuthPassword('1234')}
            onConfirm={handleAuthConfirm}
            onBack={() => setCurrentStep(STEP.PAYMENT)}
          />
        );

      case STEP.EVIDENCE_RECORD:
        return (
          <StepEvidenceRecord
            isSavingEvidence={isSavingEvidence}
            onSubmitEvidence={handleSubmitEvidence}
            onBackPayment={() => setCurrentStep(STEP.PAYMENT)}
          />
        );

      case STEP.EVIDENCE_CONFIRM:
        return (
          <StepEvidenceConfirm
            evidenceSnapshot={evidenceSnapshot}
            onRedo={() => {
              clearEvidenceMedia();
              setCurrentStep(STEP.EVIDENCE_RECORD);
            }}
            onSubmit={() => setCurrentStep(STEP.END)}
          />
        );

      case STEP.END:
        return (
          <StepEnd
            rating={rating}
            onChangeRating={setRating}
            feedback={feedback}
            onChangeFeedback={setFeedback}
            onSubmit={handleFinalSubmit}
          />
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
        cartCount={cart.length}
        totalAmount={totalAmount}
      />

      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-6xl h-[70vh] md:h-[75vh] bg-slate-50 rounded-3xl shadow-2xl border border-slate-200 p-6 md:p-8">
          {renderStep()}
        </div>
      </main>
    </div>
  );
}

export default CheckoutApp;




/* // src/components/CheckoutApp.jsx
import React, { useState, useEffect } from 'react';
import Header from './Header';

// Step components
import StepWelcome from './steps/StepWelcome';
import StepInstruction from './steps/StepInstruction';
import StepScanning from './steps/StepScanning';
import StepItemConfirm from './steps/StepItemConfirm';
import StepCart from './steps/StepCart';
import StepPaymentMethod from './steps/StepPaymentMethod';
import StepAuth from './steps/StepAuth';
import StepEvidenceRecord from './steps/StepEvidenceRecord';
import StepEvidenceConfirm from './steps/StepEvidenceConfirm';
import StepEnd from './steps/StepEnd';

// Mock 商品資料
const MOCK_ITEMS = [
  { id: 1, name: '蘋果', price: 30, image: '🍎' },
  { id: 2, name: '香蕉', price: 25, image: '🍌' },
  { id: 3, name: '沙拉油', price: 120, image: '🧴' },
  { id: 4, name: '白米 1kg', price: 85, image: '🍚' },
  { id: 5, name: '餅乾', price: 50, image: '🍪' },
];

function getRandomMockItem() {
  const base = MOCK_ITEMS[Math.floor(Math.random() * MOCK_ITEMS.length)];
  return { ...base, quantity: 1 };
}

const TOTAL_STEPS = 10;

function CheckoutApp() {
  const [currentStep, setCurrentStep] = useState(1);
  const [cart, setCart] = useState([]);
  const [currentItem, setCurrentItem] = useState(null);

  // 支付 / 賒帳
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authErrorMsg, setAuthErrorMsg] = useState('');
  const [authErrorCount, setAuthErrorCount] = useState(0);
  const [authLocked, setAuthLocked] = useState(false);

  // 存證：改成拍照 + 錄音（父層只管「存檔中」與確認頁預覽）
  const [isSavingEvidence, setIsSavingEvidence] = useState(false);
  const [evidenceSnapshot, setEvidenceSnapshot] = useState(null); // 用於 StepEvidenceConfirm 顯示照片
  const [evidenceAudioUrl, setEvidenceAudioUrl] = useState(null); // 若你想在 Confirm 播放音檔可用

  // 評分 / 回饋
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  // Step 2: 3 秒後自動進 Step 3
  useEffect(() => {
    if (currentStep === 2) {
      const timer = setTimeout(() => {
        setCurrentStep(3);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // Step 3: 2 秒後產生商品並進 Step 4
  useEffect(() => {
    if (currentStep === 3) {
      const timer = setTimeout(() => {
        const item = getRandomMockItem();
        setCurrentItem(item);
        setCurrentStep(4);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // 加入商品到購物車（同商品則數量+1）
  const addCurrentItemToCart = () => {
    if (!currentItem) return;
    setCart((prev) => {
      const index = prev.findIndex((p) => p.id === currentItem.id);
      if (index === -1) {
        return [...prev, currentItem];
      }
      const newCart = [...prev];
      newCart[index] = {
        ...newCart[index],
        quantity: newCart[index].quantity + currentItem.quantity,
      };
      return newCart;
    });
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Step 7: 確認賒帳密碼
  const handleAuthConfirm = () => {
    if (authLocked) return;
    const CORRECT_PASSWORD = '1234';

    if (authPassword === CORRECT_PASSWORD) {
      setAuthErrorMsg('');
      setAuthErrorCount(0);
      setAuthLocked(false);
      setCurrentStep(8);
    } else {
      const newCount = authErrorCount + 1;
      setAuthErrorCount(newCount);
      setAuthPassword('');
      if (newCount >= 3) {
        setAuthLocked(true);
        setAuthErrorMsg(
          '輸入錯誤已達 3 次，系統暫時鎖定，請改用其他支付方式或請店長協助。'
        );
      } else {
        setAuthErrorMsg(`通關密碼錯誤，第 ${newCount} 次，請再試一次。`);
      }
    }
  };

  const clearEvidenceMedia = () => {
    // 若你使用了 URL.createObjectURL，記得 revoke 避免 memory leak
    if (evidenceAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(evidenceAudioUrl);
    if (evidenceSnapshot?.startsWith('blob:')) URL.revokeObjectURL(evidenceSnapshot);
    setEvidenceSnapshot(null);
    setEvidenceAudioUrl(null);
  };

  // Step 8: 送出「拍照 + 錄音」FormData（先做模擬存檔）
  const handleSubmitEvidence = async (formData) => {
    if (isSavingEvidence) return;
    setIsSavingEvidence(true);

    try {
      // 讓 Step 9 有東西可以顯示：從 FormData 取出 photo/audio 生成 blob URL
      clearEvidenceMedia();

      const photo = formData.get('photo'); // File/Blob
      const audio = formData.get('audio'); // File/Blob

      if (photo instanceof Blob) {
        const photoUrl = URL.createObjectURL(photo);
        setEvidenceSnapshot(photoUrl);
      }

      if (audio instanceof Blob) {
        const audioUrl = URL.createObjectURL(audio);
        setEvidenceAudioUrl(audioUrl);
      }

      // 真 API（之後要串再打開）
      // await fetch("http://127.0.0.1:8000/evidence", { method: "POST", body: formData });

      // 先模擬後端存檔
      await new Promise((r) => setTimeout(r, 1200));

      setCurrentStep(9);
    } finally {
      setIsSavingEvidence(false);
    }
  };

  // Step 10: 送出評分並重置系統
  const handleFinalSubmit = () => {
    console.log('評分：', rating, '回饋：', feedback);
    console.log('購物車內容：', cart);

    clearEvidenceMedia();

    setCurrentStep(1);
    setCart([]);
    setCurrentItem(null);
    setPaymentMethod(null);
    setAuthPassword('');
    setAuthErrorMsg('');
    setAuthErrorCount(0);
    setAuthLocked(false);
    setIsSavingEvidence(false);
    setRating(0);
    setFeedback('');
  };

  // 根據 currentStep 渲染對應畫面
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepWelcome onStartCheckout={() => setCurrentStep(2)} />;

      case 2:
        return <StepInstruction />;

      case 3:
        return <StepScanning />;

      case 4:
        return (
          <StepItemConfirm
            currentItem={currentItem}
            onRescan={() => setCurrentStep(3)}
            onConfirmNext={() => {
              addCurrentItemToCart();
              setCurrentStep(3);
            }}
            onConfirmGoCart={() => {
              addCurrentItemToCart();
              setCurrentStep(5);
            }}
          />
        );

      case 5:
        return (
          <StepCart
            cart={cart}
            totalAmount={totalAmount}
            onGoScan={() => setCurrentStep(3)}
            onCheckout={() => {
              setPaymentMethod(null);
              setCurrentStep(6);
            }}
          />
        );

      case 6:
        return (
          <StepPaymentMethod
            totalAmount={totalAmount}
            onBackToCart={() => setCurrentStep(5)}
            onPayLinePay={() => {
              setPaymentMethod('Linepay');
              alert('模擬：已轉 Linepay Money 給飛鼠');
              setCurrentStep(10);
            }}
            onGoCredit={() => {
              setPaymentMethod('Credit');
              setCurrentStep(7);
            }}
          />
        );

      case 7:
        return (
          <StepAuth
            authPassword={authPassword}
            onChangePassword={setAuthPassword}
            authErrorMsg={authErrorMsg}
            authLocked={authLocked}
            onFillDemoPassword={() => setAuthPassword('1234')}
            onConfirm={handleAuthConfirm}
            onBack={() => setCurrentStep(6)}
          />
        );

      case 8:
        return (
          <StepEvidenceRecord
            isSavingEvidence={isSavingEvidence}
            onSubmitEvidence={handleSubmitEvidence}
            onBackPayment={() => setCurrentStep(6)}
          />
        );

      case 9:
        return (
          <StepEvidenceConfirm
            evidenceSnapshot={evidenceSnapshot}
            // 如果你想讓 Confirm 頁也能播音檔：請在 StepEvidenceConfirm.jsx 加 audio 播放器並接這個 prop
            // evidenceAudioUrl={evidenceAudioUrl}
            onRedo={() => {
              clearEvidenceMedia();
              setCurrentStep(8);
            }}
            onSubmit={() => setCurrentStep(10)}
          />
        );

      case 10:
        return (
          <StepEnd
            rating={rating}
            onChangeRating={setRating}
            feedback={feedback}
            onChangeFeedback={setFeedback}
            onSubmit={handleFinalSubmit}
          />
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
        cartCount={cart.length}
        totalAmount={totalAmount}
      />

      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-6xl h-[70vh] md:h-[75vh] bg-slate-50 rounded-3xl shadow-2xl border border-slate-200 p-6 md:p-8">
          {renderStep()}
        </div>
      </main>
    </div>
  );
}

export default CheckoutApp;






 */
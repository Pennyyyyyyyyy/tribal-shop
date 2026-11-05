 // src/components/steps/StepPaymentMethod.jsx
import React from 'react';

function StepPaymentMethod({ totalAmount, onBackToCart, onPayLinePay, onGoCredit }) {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 text-center">
      <h2 className="text-3xl font-bold text-slate-800">請選擇支付方式</h2>
      <p className="text-lg text-slate-600">
        本次消費金額：
        <span className="text-2xl text-green-700 font-semibold ml-1">
          NT${totalAmount}
        </span>
      </p>
      <div className="flex flex-col md:flex-row gap-6 mt-4">
        <button
          onClick={onPayLinePay}
          className="px-8 py-4 rounded-2xl bg-green-600 text-white text-lg font-bold shadow-lg hover:bg-green-500 transition-transform hover:scale-105 active:scale-95"
        >
          🟢 Line Pay 付款
        </button>
        <button
          onClick={onGoCredit}
          className="px-8 py-4 rounded-2xl bg-slate-800 text-white text-lg font-bold shadow-lg hover:bg-slate-700 transition-transform hover:scale-105 active:scale-95"
        >
          📘 賒帳（限已註冊居民）
        </button>
      </div>
      <button
        onClick={onBackToCart}
        className="mt-4 text-slate-500 underline text-sm"
      >
        ⬅ 返回購物車
      </button>
    </div>
  );
}

export default StepPaymentMethod;

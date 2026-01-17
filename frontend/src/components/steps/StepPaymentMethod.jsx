 // src/components/steps/StepPaymentMethod.jsx
import React from 'react';

function StepPaymentMethod({ totalAmount, onBackToCart, onPayLinePay, onGoCredit }) {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 text-center">
      <h2 className="text-3xl font-bold text-slate-800">請選擇支付方式</h2>
      <p className="text-lg text-slate-600">
        本次消費金額：
        <span className="text-2xl text-green-700 font-semibold">
          ${totalAmount}
        </span>
      </p>
      <div className="flex flex-col md:flex-row gap-6 mt-4">
        <button
          onClick={onPayLinePay}
          className="px-10 py-5 rounded-2xl bg-emerald-600 text-white text-xl font-bold shadow-lg hover:bg-emerald-500 transition-transform hover:scale-105 active:scale-95"
        >
          🟢 Line Pay 付款
        </button>
        <button
          onClick={onGoCredit}
          className="px-10 py-5 rounded-2xl bg-slate-800 text-white text-xl font-bold shadow-lg hover:bg-slate-700 transition-transform hover:scale-105 active:scale-95"
        >
          📘 賒帳（限已註冊族人）
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


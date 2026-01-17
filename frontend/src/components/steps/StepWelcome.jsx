 // src/components/steps/StepWelcome.jsx
import React from 'react';

function StepWelcome({ onStartCheckout }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
      <div className="text-6xl mb-2">👋</div>
      <h2 className="text-4xl font-bold text-slate-800">Welcome!</h2>
      <p className="text-xl text-slate-600">歡迎來到部落誠實商店自助結帳系統</p>
      <div className="flex flex-col md:flex-row gap-6 mt-6">
        <button
          onClick={() => console.log('教學功能待開發')}
          className="px-10 py-5 rounded-2xl bg-slate-200 hover:bg-slate-300 text-xl font-semibold shadow-md transition-transform hover:scale-105 active:scale-95"
        >
          📚 教學（尚未開放）
        </button>
        <button
          onClick={onStartCheckout}
          className="px-10 py-5 rounded-2xl bg-green-600 hover:bg-green-500 text-white text-2xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          🛒 開始結帳
        </button>
      </div>
    </div>
  );
}

export default StepWelcome;


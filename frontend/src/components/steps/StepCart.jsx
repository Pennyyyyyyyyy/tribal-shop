 // src/components/steps/StepCart.jsx
import React from 'react';

function StepCart({ cart, totalAmount, onGoScan, onCheckout }) {
  const isEmpty = cart.length === 0;

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold text-slate-800">購物車清單</h2>
        {!isEmpty && (
          <button
            onClick={onGoScan}
            className="px-6 py-3 rounded-2xl bg-slate-200 text-slate-700 text-base font-semibold hover:bg-slate-300 shadow-md"
          >
            ➕ 繼續辨識商品
          </button>
        )}
      </div>
      <div className="flex-1 bg-white rounded-3xl shadow-inner border border-slate-100 p-6 overflow-auto">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
            <div className="text-5xl">🛒</div>
            <div className="text-lg">目前購物車是空的，請先辨識商品。</div>
            <button
              onClick={onGoScan}
              className="mt-2 px-8 py-4 rounded-2xl bg-green-600 text-white font-bold text-lg hover:bg-green-500 shadow-lg"
            >
              開始辨識商品
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 表頭 */}
            <div className="grid grid-cols-[auto_1fr_80px_100px] items-center gap-4 px-4 py-2 text-sm font-semibold text-slate-400">
              <div className="w-10" />
              <div>商品名稱</div>
              <div className="text-center">數量</div>
              <div className="text-right">小計</div>
            </div>
            {cart.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[auto_1fr_80px_100px] items-center gap-4 bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100"
              >
                <div className="text-3xl w-10 text-center">{item.image}</div>
                <div>
                  <div className="text-lg font-semibold text-slate-800">{item.name}</div>
                  <div className="text-xs text-slate-400">單價 NT${item.price}</div>
                </div>
                <div className="text-center text-lg text-slate-700">{item.quantity}</div>
                <div className="text-right text-lg font-bold text-green-700">
                  NT${item.price * item.quantity}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xl font-semibold text-slate-800">
          總金額：
          <span className="text-2xl text-green-700 ml-1">NT${totalAmount}</span>
        </div>
        <button
          disabled={isEmpty}
          onClick={onCheckout}
          className={`px-8 py-4 rounded-2xl text-lg font-bold shadow-lg transition-transform ${
            isEmpty
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-500 hover:scale-105 active:scale-95'
          }`}
        >
          💳 結帳
        </button>
      </div>
    </div>
  );
}

export default StepCart;

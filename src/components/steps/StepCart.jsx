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
            className="px-4 py-2 rounded-xl bg-sky-100 text-sky-800 text-sm font-semibold hover:bg-sky-200"
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
                className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100"
              >
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{item.image}</div>
                  <div>
                    <div className="text-lg font-semibold text-slate-800">
                      {item.name}
                    </div>
                    <div className="text-sm text-slate-500">
                      數量：{item.quantity}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-700">
                    ${item.price * item.quantity}
                  </div>
                  <div className="text-xs text-slate-400">單價：${item.price}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xl font-semibold text-slate-800">
          總金額：
          <span className="text-2xl text-green-700">${totalAmount}</span>
        </div>
        <button
          disabled={isEmpty}
          onClick={onCheckout}
          className={`px-8 py-4 rounded-2xl text-xl font-bold shadow-lg transition-transform ${
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


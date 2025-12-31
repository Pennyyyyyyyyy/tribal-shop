 // src/components/steps/StepItemConfirm.jsx
import React from 'react';

function StepItemConfirm({ currentItem, onRescan, onConfirmNext, onConfirmGoCart }) {
  return (
    <div className="flex flex-col w-full h-full">
      <h2 className="text-3xl font-bold text-slate-800 mb-4 text-center">
        請確認這個商品是否正確
      </h2>
      <div className="flex-1 flex flex-col md:flex-row gap-8">
        <div className="flex-1 flex items-center justify-center">
          {!currentItem ? (
            <div className="text-slate-500">尚未取得商品資訊</div>
          ) : (
            <div className="bg-white rounded-3xl shadow-xl p-8 flex flex-col items-center w-full max-w-md border border-slate-100">
              <div className="text-7xl mb-4">{currentItem.image}</div>
              <div className="text-2xl font-bold text-slate-800 mb-2">
                {currentItem.name}
              </div>
              <div className="text-lg text-slate-600 mb-1">
                數量：{currentItem.quantity}
              </div>
              <div className="text-xl font-semibold text-green-700 mb-4">
                金額：${currentItem.price}
              </div>
              <div className="text-sm text-slate-400">
                若商品不正確，請選擇重新辨識。
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col justify-center gap-4">
          <button
            onClick={onRescan}
            className="w-full px-6 py-4 rounded-2xl bg-red-100 text-red-700 font-semibold text-lg hover:bg-red-200 shadow-md transition-transform hover:scale-105 active:scale-95"
          >
            ❌ 錯誤，重新辨識
          </button>
          <button
            onClick={onConfirmNext}
            className="w-full px-6 py-4 rounded-2xl bg-sky-100 text-sky-800 font-semibold text-lg hover:bg-sky-200 shadow-md transition-transform hover:scale-105 active:scale-95"
          >
            ➕ 正確，辨識下一個物品
          </button>
          <button
            onClick={onConfirmGoCart}
            className="w-full px-6 py-4 rounded-2xl bg-green-600 text-white font-bold text-xl hover:bg-green-500 shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            🛒 正確，進入購物車
          </button>
          <p className="text-sm text-slate-500 mt-2">
            已辨識的商品會加入購物車中，您可以重複辨識多樣商品再一次確認。
          </p>
        </div>
      </div>
    </div>
  );
}

export default StepItemConfirm;


 // src/components/steps/StepEnd.jsx
import React from 'react';

function StepEnd({
  rating,
  onChangeRating,
  feedback,
  onChangeFeedback,
  onSubmit,
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
      <div className="text-6xl mb-2">🎉</div>
      <h2 className="text-3xl font-bold text-green-700">感謝您的使用！</h2>
      <p className="text-lg text-slate-600 max-w-xl">
        商家會再確認存貨與消費內容。如有問題，店家會主動與您聯繫。
      </p>
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 px-8 py-6 w-full max-w-2xl text-left">
        <h3 className="text-xl font-semibold text-slate-800 mb-3">
          今日的自助結帳體驗如何？
        </h3>
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChangeRating(star)}
              className={`text-3xl transition-transform hover:scale-110 ${
                rating >= star ? 'text-yellow-400' : 'text-slate-300'
              }`}
            >
              ★
            </button>
          ))}
          <span className="ml-2 text-sm text-slate-500">
            {rating > 0 ? `已給予 ${rating} 分` : '請點選星星評分'}
          </span>
        </div>
        <label className="block text-slate-700 mb-2 font-semibold">
          想說的話（選填）
        </label>
        <textarea
          rows={4}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="例如：哪裡使用順、哪裡可以改進，或想跟店長說的話。"
          value={feedback}
          onChange={(e) => onChangeFeedback(e.target.value)}
        />
      </div>
      <button
        onClick={onSubmit}
        className="px-8 py-4 rounded-2xl bg-green-600 text-white text-lg font-bold shadow-lg hover:bg-green-500 transition-transform hover:scale-105 active:scale-95 w-full max-w-2xl"
      >
        ✅ 送出並回到首頁
      </button>
    </div>
  );
}

export default StepEnd;

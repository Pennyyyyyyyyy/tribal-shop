 // src/components/steps/StepAuth.jsx
import React from 'react';

function StepAuth({
  authPassword,
  onChangePassword,
  authErrorMsg,
  authLocked,
  onFillDemoPassword,
  onConfirm,
  onBack,
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6">
      <h2 className="text-3xl font-bold text-slate-800 mb-2">賒帳身份驗證</h2>
      <p className="text-lg text-slate-600 max-w-xl text-center">
        請輸入通關密碼完成身份確認。
        <br />
        <span className="text-sm text-slate-500">
          （可搭配族語提示或口訣，例如：某句族語密語）
        </span>
      </p>
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 px-8 py-6 w-full max-w-md">
        <label className="block text-left text-slate-700 mb-2 font-semibold">
          通關密碼
        </label>
        <input
          type="password"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="請輸入 4 位數密碼"
          value={authPassword}
          onChange={(e) => onChangePassword(e.target.value)}
          disabled={authLocked}
        />
        {authErrorMsg && (
          <div className="mt-2 text-sm text-red-600">{authErrorMsg}</div>
        )}
        <div className="flex flex-col md:flex-row gap-4 mt-6">
          <button
            type="button"
            onClick={onFillDemoPassword}
            disabled={authLocked}
            className={`flex-1 px-6 py-3 rounded-2xl text-base font-semibold shadow-md ${
              authLocked
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            🔁 回填示範密碼
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={authLocked}
            className={`flex-1 px-6 py-3 rounded-2xl text-base font-bold shadow-md ${
              authLocked
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-500'
            }`}
          >
            ✅ 確認
          </button>
        </div>
        <button
          onClick={onBack}
          className="mt-4 text-slate-500 underline text-sm"
        >
          ⬅ 返回支付方式選擇
        </button>
      </div>
    </div>
  );
}

export default StepAuth;

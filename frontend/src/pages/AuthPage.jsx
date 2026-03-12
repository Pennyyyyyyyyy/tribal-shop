import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthPage() {
  const navigate = useNavigate();

  const [authPassword, setAuthPassword] = useState("");
  const [authErrorMsg, setAuthErrorMsg] = useState("");
  const [authErrorCount, setAuthErrorCount] = useState(0);
  const [authLocked, setAuthLocked] = useState(false);

  const handleAuthConfirm = () => {
    if (authLocked) return;

    const CORRECT_PASSWORD = "1234";
    if (authPassword === CORRECT_PASSWORD) {
      navigate("/instruction");
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
        onClick={() => navigate("/")}
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
                className={`h-16 rounded-2xl shadow text-xl font-semibold transition ${
                  authLocked
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
              className={`flex-1 h-14 rounded-2xl shadow font-semibold transition ${
                authLocked
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
              className={`flex-1 h-14 rounded-2xl shadow font-semibold text-white transition ${
                authLocked || authPassword.length < 4
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

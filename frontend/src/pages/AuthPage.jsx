import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AnnouncementPopup from "../components/AnnouncementPopup";
import { useAnnouncement } from "../context/AnnouncementContext";
import BackButton from "../components/BackButton";

const PASSWORD_LENGTH = 4;

export default function AuthPage() {
  const navigate = useNavigate();
  const { openPopup, dismissed } = useAnnouncement();

  const [authPassword, setAuthPassword] = useState("");
  const [authErrorMsg, setAuthErrorMsg] = useState("");
  const [authErrorCount, setAuthErrorCount] = useState(0);
  const [authLocked, setAuthLocked] = useState(false);

  useEffect(() => {
    if (!dismissed) openPopup();
  }, [dismissed, openPopup]);

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
    if (authPassword.length >= PASSWORD_LENGTH) return;
    setAuthPassword((prev) => prev + d);
  };

  const onClear = () => {
    if (authLocked) return;
    setAuthPassword("");
  };

  const onBackspace = () => {
    if (authLocked) return;
    setAuthPassword((prev) => prev.slice(0, -1));
  };

  const keyClass = "btn-press h-[84px] bg-paper text-[34px] text-ink";

  return (
    <div className="flex-1 grid grid-cols-[minmax(0,1fr)_440px] gap-[72px] px-16 items-center">
      <AnnouncementPopup />

      <div className="flex flex-col gap-5">
        <BackButton to="/" />
        <h1 className="mt-3 font-display text-[56px] leading-tight">賒帳身份驗證</h1>
        <p className="text-[22px] leading-relaxed opacity-85">
          請輸入通關密碼，完成身份確認。
        </p>

        <div className="mt-3 text-[17px] font-bold" id="pw-label">輸入的密碼</div>
        <div
          aria-labelledby="pw-label"
          aria-live="polite"
          className="h-[84px] border-[3px] border-ink rounded-[20px] bg-paper flex items-center gap-[18px] px-7"
        >
          {Array.from({ length: PASSWORD_LENGTH }).map((_, i) =>
            i < authPassword.length ? (
              <span key={i} className="w-[18px] h-[18px] rounded-full bg-ink" />
            ) : (
              <span key={i} className="w-[18px] h-[18px] rounded-full border-[3px] border-ink/30" />
            )
          )}
          <span className="sr-only">已輸入 {authPassword.length} 位</span>
        </div>

        {authErrorMsg && (
          <div className="border-2 border-clay bg-peach rounded-2xl px-5 py-3.5 text-[17px] font-medium">
            {authErrorMsg}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button
              key={n}
              type="button"
              data-testid={`keypad-${n}`}
              onClick={() => onPressDigit(n)}
              disabled={authLocked}
              className={keyClass}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            data-testid="btn-clear"
            onClick={onClear}
            disabled={authLocked}
            className="btn-ghost h-[84px] text-[22px]"
          >
            清除
          </button>
          <button
            type="button"
            data-testid="keypad-0"
            onClick={() => onPressDigit("0")}
            disabled={authLocked}
            className={keyClass}
          >
            0
          </button>
          <button
            type="button"
            onClick={onBackspace}
            disabled={authLocked}
            className="btn-ghost h-[84px]"
            aria-label="刪除一位"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
              <path d="M17 9l-6 6M11 9l6 6" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          data-testid="btn-confirm"
          onClick={handleAuthConfirm}
          disabled={authLocked || authPassword.length < PASSWORD_LENGTH}
          className="btn-press mt-2 h-[88px] bg-forest text-paper text-[32px]"
        >
          確認
        </button>
      </div>
    </div>
  );
}

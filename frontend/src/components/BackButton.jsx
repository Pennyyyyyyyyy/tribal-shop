import React from "react";
import { useNavigate } from "react-router-dom";

// 設計稿通用「‹ 返回」按鈕。
// variant="ghost"：沙色底，放在奶油底頁面上；variant="chip"：半透明紙白，浮在相機畫面上。
export default function BackButton({ to, onClick, label = "返回上一步", variant = "ghost", className = "" }) {
  const navigate = useNavigate();
  const base =
    variant === "chip"
      ? "chipbtn focus-ring"
      : "btn-ghost focus-ring self-start shrink-0 h-12 pl-2.5 pr-5 rounded-2xl text-[17px] gap-1";

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick ?? (() => navigate(to))}
      className={`${base} ${className}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      返回
    </button>
  );
}

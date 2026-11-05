import React from "react";

// Go-Remote 品牌標誌。LOGO 圖檔還沒定，先用虛線圓圈佔位。
// tone="light" 用在綠色頂欄上，tone="dark" 用在奶油底上。
// 傳 onClick 時整個標誌變成按鈕（POS 用來回到首頁）。
export default function BrandMark({ tone = "dark", subtitle = "自助結帳系統", size = "md", onClick, label = "回到首頁" }) {
  const light = tone === "light";
  const circle = size === "sm" ? "w-12 h-12 text-[10px]" : size === "lg" ? "w-[60px] h-[60px] text-xs" : "w-14 h-14 text-[11px]";
  const title = size === "sm" ? "text-2xl" : size === "lg" ? "text-[28px]" : "text-[26px]";

  const Wrapper = onClick ? "button" : "div";
  const wrapperProps = onClick
    ? { type: "button", onClick, "aria-label": label, className: "focus-ring flex items-center gap-3.5 shrink-0 text-left rounded-2xl cursor-pointer" }
    : { className: "flex items-center gap-3.5 shrink-0" };

  return (
    <Wrapper {...wrapperProps}>
      <div
        className={`${circle} rounded-full border-2 border-dashed flex items-center justify-center ${
          light ? "border-paper/60 text-paper/85" : "border-ink/50 text-ink/70"
        }`}
        aria-hidden="true"
      >
        LOGO
      </div>
      <div>
        <div className={`font-display ${title} leading-tight`}>Go-Remote</div>
        {subtitle && <div className="text-[13px] opacity-85">{subtitle}</div>}
      </div>
    </Wrapper>
  );
}

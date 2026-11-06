import React from "react";

// Go-Remote 品牌標誌。圖檔是 public/logo-mark.png（只有圖案、透明背景，由 public/logo.jpg 去背裁切）。
// logo 的 G 是深綠色，放在綠色頂欄上會看不見，所以 tone="light"（綠色頂欄）墊一個紙白圓底；
// tone="dark"（奶油底）直接放透明圖，不加底色和框。
// 傳 onClick 時整個標誌變成按鈕（POS 用來回到首頁）。
export default function BrandMark({ tone = "dark", subtitle = "自助結帳系統", size = "md", onClick, label = "回到首頁" }) {
  const light = tone === "light";
  const circle = size === "sm" ? "w-12 h-12" : size === "lg" ? "w-[60px] h-[60px]" : "w-14 h-14";
  const title = size === "sm" ? "text-2xl" : size === "lg" ? "text-[28px]" : "text-[26px]";

  const Wrapper = onClick ? "button" : "div";
  const wrapperProps = onClick
    ? { type: "button", onClick, "aria-label": label, className: "focus-ring flex items-center gap-3.5 shrink-0 text-left rounded-2xl cursor-pointer" }
    : { className: "flex items-center gap-3.5 shrink-0" };

  return (
    <Wrapper {...wrapperProps}>
      <div
        className={`${circle} shrink-0 flex items-center justify-center ${light ? "rounded-full bg-paper" : ""}`}
        aria-hidden="true"
      >
        <img
          src="/logo-mark.png"
          alt=""
          className={`${light ? "w-[86%] h-[86%]" : "w-full h-full"} object-contain`}
          draggable="false"
        />
      </div>
      <div>
        <div className={`font-display ${title} leading-tight`}>Go-Remote</div>
        {subtitle && <div className="text-[13px] opacity-85">{subtitle}</div>}
      </div>
    </Wrapper>
  );
}

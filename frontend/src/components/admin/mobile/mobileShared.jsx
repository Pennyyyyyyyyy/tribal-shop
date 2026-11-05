// 手機版後台共用的版面小元件
import React from "react";

// 頁面標題列：標題 + 副標 + 右側動作（例如「新增商品」）
export function PageHeader({ title, subtitle, action }) {
    return (
        <div className="flex items-center gap-3">
            <div className="min-w-0">
                <h1 className="font-display text-[30px] leading-tight">{title}</h1>
                {subtitle && <div className="text-sm mt-0.5">{subtitle}</div>}
            </div>
            {action && <div className="ml-auto shrink-0">{action}</div>}
        </div>
    );
}

// 一張列表卡片。strong=true 用粗框 + 實心陰影（展開中 / 需要處理的項目）
export function Card({ strong = false, className = "", children, ...rest }) {
    return (
        <div
            className={`bg-paper rounded-[18px] p-3.5 ${strong ? "border-[3px] border-ink shadow-press-sm" : "border-2 border-ink"} ${className}`}
            {...rest}
        >
            {children}
        </div>
    );
}

// 可左右滑的膠囊列，兩側延伸到螢幕邊（抵銷 main 的 px-4）
export function PillRow({ children }) {
    return (
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pt-0.5 pb-1.5">
            {children}
        </div>
    );
}

export function Pill({ on, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={on}
            className={`focus-ring pill h-11 shrink-0 ${on ? "pill-on" : ""}`}
        >
            {children}
        </button>
    );
}

export function Loading() {
    return <div className="py-10 text-center text-base opacity-70">載入中…</div>;
}

export function Empty({ children }) {
    return <div className="py-10 text-center text-base opacity-70">{children}</div>;
}

// 右上角的主要行動按鈕（新增商品 / 新增居民）
export function HeaderButton({ onClick, children }) {
    return (
        <button
            onClick={onClick}
            className="btn-press h-12 px-4 rounded-2xl shadow-press-sm bg-clay text-paper text-[17px] whitespace-nowrap"
        >
            {children}
        </button>
    );
}

// 商品縮圖（56px）；沒圖時顯示虛線框 + 文字
export function Thumb({ src, label }) {
    return src ? (
        <img src={src} alt="" className="w-14 h-14 shrink-0 object-cover rounded-xl border-2 border-sand bg-paper" />
    ) : (
        <div className="w-14 h-14 shrink-0 rounded-xl border-2 border-dashed border-sand flex items-center justify-center text-xs" aria-hidden="true">
            {label}
        </div>
    );
}

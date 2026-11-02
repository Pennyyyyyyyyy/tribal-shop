// 分潤頁共用：狀態標籤、試算卡片、通知列（電腦版與手機版都用）
import React from "react";

export function StatusBadge({ status }) {
    if (status === "paid") {
        return (
            <span className="chip bg-moss">
                已付
            </span>
        );
    }
    return (
        <span className="chip bg-peach">
            待付
        </span>
    );
}

// 批次試算的單張族人卡：顯示 KPI 一列 + 可展開商品明細 + checkbox。
// gross=0 → 顯示灰化且不能勾。
export function ConsignorPreviewCard({ preview, checked, onToggleSelect, expanded, onToggleExpand }) {
    const p = preview;
    const noSales = p.gross_amount === 0;
    const name = p.consignor.nickname || p.consignor.line_id;
    const ratePct = p.gross_amount > 0 ? Math.round((p.commission_amount / p.gross_amount) * 100) : 0;
    return (
        <div className={
            "rounded-[18px] p-4 flex flex-col gap-2.5 transition-colors " +
            (noSales ? "border-2 border-dashed border-sand opacity-70" : checked ? "border-[3px] border-ink bg-cream" : "border-[3px] border-sand bg-paper")
        }>
            <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={noSales}
                    onChange={onToggleSelect}
                    aria-label={`選取${name}`}
                    className="w-5 h-5 accent-forest disabled:cursor-not-allowed"
                />
                <span className="font-display text-[22px]">{name}</span>
            </label>
            {noSales ? (
                <div className="text-[15px]">此期間無銷售</div>
            ) : (
                <>
                    <div className="flex justify-between text-[15px]">
                        <span>總銷售</span><span className="tabular-nums">NT${p.gross_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[15px]">
                        <span>店家抽成 {ratePct}%</span><span className="tabular-nums">NT${p.commission_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2 border-t-2 border-dashed border-sand">
                        <span className="font-bold">應付</span>
                        <span className="font-display text-[26px] text-forest tabular-nums">NT${p.net_payout.toLocaleString()}</span>
                    </div>
                    <button
                        type="button"
                        onClick={onToggleExpand}
                        aria-expanded={expanded}
                        className="btn-ghost h-10 rounded-xl text-[15px]"
                    >
                        {expanded ? "收起明細" : `明細（${p.items.length} 種商品）`}
                    </button>
                </>
            )}
            {expanded && !noSales && p.items.length > 0 && (
                <table className="w-full text-sm">
                    <tbody className="divide-y-2 divide-wheat">
                        {p.items.map(it => (
                            <tr key={it.product_id}>
                                <td className="py-1.5">{it.product_name}</td>
                                <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                                    ${it.unit_price} × {it.quantity}
                                </td>
                                <td className="py-1.5 text-right font-bold tabular-nums w-20">
                                    ${it.subtotal.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export function Notice({ notice, onClose }) {
    const palette = {
        green: "bg-moss border-forest",
        amber: "bg-peach border-clay",
        red: "bg-peach border-clay",
    }[notice.type] || "bg-paper border-sand";
    return (
        <div role="status" className={`flex items-center justify-between border-2 rounded-2xl px-4 py-2.5 ${palette}`}>
            <span className="text-[15px] font-medium">{notice.type === "red" ? "⚠ " : ""}{notice.text}</span>
            <button onClick={onClose} aria-label="關閉通知" className="focus-ring rounded px-1 font-bold">✕</button>
        </div>
    );
}

export function ErrorBanner({ children, className = "" }) {
    return (
        <div role="alert" className={`text-[15px] border-2 border-clay bg-peach rounded-2xl px-4 py-2.5 ${className}`}>
            {children}
        </div>
    );
}

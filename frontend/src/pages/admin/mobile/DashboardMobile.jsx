import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useDashboardData, LOW_STOCK_THRESHOLD } from "../../../hooks/useDashboardData";
import { ErrorBox, StockModal } from "../../../components/admin/adminShared";
import { Loading } from "../../../components/admin/mobile/mobileShared";

export default function DashboardMobile() {
    const { data, debtors, lowStock, error, reload } = useDashboardData();
    const [editing, setEditing] = useState(null);

    if (error) return <ErrorBox message={error} />;
    if (!data) return <Loading />;

    return (
        <div className="flex flex-col gap-3.5">
            <div className="flex items-baseline gap-2.5 flex-wrap">
                <h1 className="font-display text-[30px] leading-tight">今日總覽</h1>
                <span className="text-sm tabular-nums">
                    {new Date().toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei", month: "long", day: "numeric", weekday: "short" })}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Kpi label="今日營收" value={`NT$${(data.today_revenue || 0).toLocaleString()}`} valueClass="text-forest" />
                <Kpi label="今日筆數" value={`${data.today_transaction_count || 0}`} suffix="筆" />
                <Kpi label="未收欠款" value={`NT$${(data.outstanding_debt || 0).toLocaleString()}`} warn={data.outstanding_debt > 0} />
                <Kpi label={`即將補貨（≤ ${LOW_STOCK_THRESHOLD}）`} value={`${lowStock.length}`} suffix="項" warn={lowStock.length > 0} />
            </div>

            <section className="panel px-3.5 pt-4 pb-1.5">
                <div className="flex justify-between items-baseline mb-1.5">
                    <h2 className="font-display text-[22px]">賒帳明細</h2>
                    <span className="text-[13px]">按金額排序</span>
                </div>
                {debtors.length === 0 ? (
                    <div className="py-6 text-center text-base opacity-60">目前沒有未收欠款</div>
                ) : (
                    <ul>
                        {debtors.map((m, i) => (
                            <li key={m.id} className={i > 0 ? "border-t-2 border-wheat" : ""}>
                                <Link to="/admin/members" className="focus-ring rounded-lg flex items-center gap-2.5 py-2.5 min-h-[44px]">
                                    <span className="flex-1 min-w-0 truncate font-bold">{m.nickname}</span>
                                    <span className="font-display text-[19px] text-rust tabular-nums">NT${m.total_debt.toLocaleString()}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="panel px-3.5 py-4 flex flex-col gap-2.5">
                <div className="flex justify-between items-center gap-3">
                    <h2 className="font-display text-[22px]">低庫存品項</h2>
                    <Link to="/admin/products" className="focus-ring rounded min-h-[44px] flex items-center text-forest font-bold text-[15px] underline">
                        到商品頁補貨
                    </Link>
                </div>
                {lowStock.length === 0 ? (
                    <div className="py-6 text-center text-base opacity-60">庫存都還算足夠</div>
                ) : lowStock.map(p => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => setEditing(p)}
                        aria-label={`修改「${p.name}」庫存，目前剩 ${p.stock}`}
                        className="focus-ring flex items-center gap-3 bg-cream rounded-[14px] py-2 pr-3.5 pl-2 min-h-[44px] text-left active:bg-wheat"
                    >
                        {p.image_url ? (
                            <img src={p.image_url} alt="" className="w-11 h-11 object-cover rounded-[10px] bg-paper" />
                        ) : (
                            <div className="w-11 h-11 rounded-[10px] bg-sand" aria-hidden="true" />
                        )}
                        <span className="flex-1 min-w-0 truncate font-bold">{p.name}</span>
                        <span className={`shrink-0 font-bold tabular-nums ${p.stock <= 2 ? "text-clay" : "text-rust"}`}>剩 {p.stock}</span>
                        <span aria-hidden="true" className="shrink-0 text-lg opacity-50">›</span>
                    </button>
                ))}
            </section>

            {editing && (
                <StockModal
                    product={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); reload(); }}
                />
            )}
        </div>
    );
}

function Kpi({ label, value, suffix, warn, valueClass = "" }) {
    return (
        <div className={`panel shadow-press-sm px-3.5 pt-3.5 pb-3 min-w-0 ${warn ? "bg-peach" : ""}`}>
            <div className="text-[13px] font-bold">{label}</div>
            <div className={`mt-1 font-display text-[26px] leading-tight tabular-nums truncate ${valueClass}`}>
                {value}
                {suffix && <span className="text-[15px] ml-1">{suffix}</span>}
            </div>
        </div>
    );
}

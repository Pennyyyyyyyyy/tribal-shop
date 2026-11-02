import React from "react";
import { Link } from "react-router-dom";
import { useDashboardData } from "../../hooks/useDashboardData";
import { ErrorBox } from "../../components/admin/adminShared";

export default function DashboardPage() {
    const { data, debtors, lowStock, error } = useDashboardData();

    if (error) return <ErrorBox message={error} />;
    if (!data) return <div className="text-base opacity-70">載入中…</div>;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-baseline gap-4 flex-wrap">
                <h1 className="font-display text-[38px]">今日總覽</h1>
                <span className="text-base tabular-nums">
                    {new Date().toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei", month: "long", day: "numeric", weekday: "short" })}
                </span>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[18px]">
                <KpiCard
                    label="今日營收"
                    value={`NT$${(data.today_revenue || 0).toLocaleString()}`}
                    valueClass="text-forest"
                />
                <KpiCard
                    label="今日筆數"
                    value={`${data.today_transaction_count || 0}`}
                    suffix="筆"
                />
                <KpiCard
                    label="未收欠款"
                    value={`NT$${(data.outstanding_debt || 0).toLocaleString()}`}
                    warn={data.outstanding_debt > 0}
                />
                <KpiCard
                    label="即將補貨（庫存 ≤ 5）"
                    value={`${lowStock.length}`}
                    suffix="項"
                    warn={lowStock.length > 0}
                />
            </div>

            {/* 賒帳明細 + 低庫存 */}
            {/* 8 欄：賒帳明細 3 欄（約到「今日筆數」中間），低庫存 5 欄 */}
            <div className="grid grid-cols-1 lg:grid-cols-8 gap-[18px] items-start">
                <section className="panel lg:col-span-3 min-w-0 overflow-hidden">
                    <div className="flex justify-between items-baseline px-[22px] pt-5 pb-3.5">
                        <h2 className="font-display text-[26px]">賒帳明細</h2>
                        <span className="text-sm">按金額排序</span>
                    </div>
                    {debtors.length === 0 ? (
                        <EmptyState>目前沒有未收欠款</EmptyState>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="data-table">
                                    <thead>
                                        <tr><th>族人</th><th className="text-right">欠款</th></tr>
                                    </thead>
                                    <tbody>
                                        {debtors.map(m => (
                                            <tr key={m.id} className="hover:bg-cream transition-colors">
                                                <td className="font-bold">
                                                    <Link to="/admin/members" className="focus-ring rounded hover:underline">
                                                        {m.nickname}
                                                    </Link>
                                                </td>
                                                <td className="text-right tabular-nums font-display text-xl text-rust">
                                                    NT${m.total_debt.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-[18px] py-3 border-t-2 border-wheat flex justify-between text-sm">
                                <span>共 {debtors.length} 位</span>
                                <span>合計 NT${data.outstanding_debt.toLocaleString()}</span>
                            </div>
                        </>
                    )}
                </section>

                <section className="panel lg:col-span-5 min-w-0 px-[22px] py-5 flex flex-col gap-3">
                    <div className="flex justify-between items-center gap-3 mb-1">
                        <h2 className="font-display text-[26px]">低庫存品項</h2>
                        <Link to="/admin/products" className="focus-ring rounded text-forest font-bold text-[15px] underline">
                            到商品頁補貨
                        </Link>
                    </div>
                    {lowStock.length === 0 ? (
                        <EmptyState>庫存都還算足夠</EmptyState>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {lowStock.map(p => (
                                <div key={p.id} className="flex items-center gap-3 bg-cream rounded-[14px] py-2 pr-3.5 pl-2 min-w-0">
                                    {p.image_url ? (
                                        <img src={p.image_url} alt="" className="w-11 h-11 object-cover rounded-[10px] bg-paper" />
                                    ) : (
                                        <div className="w-11 h-11 rounded-[10px] bg-sand" aria-hidden="true" />
                                    )}
                                    <span className="flex-1 min-w-0 truncate font-bold">{p.name}</span>
                                    <span className={`shrink-0 font-bold tabular-nums ${p.stock <= 2 ? "text-clay" : "text-rust"}`}>
                                        剩 {p.stock}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

function KpiCard({ label, value, suffix, warn, valueClass = "" }) {
    return (
        <div className={`panel shadow-press px-[22px] py-5 ${warn ? "bg-peach" : ""}`}>
            <div className="text-[15px] font-bold">{label}</div>
            <div className={`mt-1.5 font-display text-[44px] leading-tight tabular-nums ${valueClass}`}>
                {value}
                {suffix && <span className="text-[22px] ml-1">{suffix}</span>}
            </div>
        </div>
    );
}

function EmptyState({ children }) {
    return <div className="py-8 text-center text-base opacity-60">{children}</div>;
}

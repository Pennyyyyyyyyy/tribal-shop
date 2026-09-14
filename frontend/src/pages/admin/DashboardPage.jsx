import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../../service/adminApi";

export default function DashboardPage() {
    const [data, setData] = useState(null);
    const [members, setMembers] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;
        Promise.all([api.stats.dashboard(), api.members.list()])
            .then(([d, m]) => {
                if (!alive) return;
                setData(d);
                setMembers(m);
            })
            .catch(err => alive && setError(err.message));
        return () => { alive = false; };
    }, []);

    if (error) return <ErrorBox message={error} />;
    if (!data) return <div className="text-sm text-slate-500">載入中…</div>;

    const debtors = members
        .filter(m => (m.total_debt || 0) > 0)
        .sort((a, b) => (b.total_debt || 0) - (a.total_debt || 0));

    return (
        <div className="space-y-6">
            <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold text-slate-800">今日總覽</h2>
                <div className="text-xs text-slate-500 tabular-nums">
                    {new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" })}
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                    label="今日營收"
                    value={`$${(data.today_revenue || 0).toLocaleString()}`}
                    tone="primary"
                />
                <KpiCard
                    label="今日筆數"
                    value={`${data.today_transaction_count || 0}`}
                    suffix="筆"
                />
                <KpiCard
                    label="未收欠款"
                    value={`$${(data.outstanding_debt || 0).toLocaleString()}`}
                    tone={data.outstanding_debt > 0 ? "warn" : undefined}
                />
                <KpiCard
                    label="低庫存品項"
                    value={`${(data.low_stock || []).length}`}
                    suffix="項"
                    tone={(data.low_stock || []).length > 0 ? "warn" : undefined}
                />
            </div>

            {/* 賒帳明細 + 低庫存 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Panel title="賒帳明細" hint="按金額排序">
                    {debtors.length === 0 ? (
                        <EmptyState>目前沒有未收欠款</EmptyState>
                    ) : (
                        <>
                            <ul className="divide-y divide-slate-100">
                                {debtors.map((m, i) => (
                                    <li key={m.id}>
                                        <Link
                                            to="/admin/members"
                                            className="flex items-center py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-100 transition-colors"
                                        >
                                            <span className="w-8 text-xs text-slate-400 tabular-nums font-medium">
                                                {String(i + 1).padStart(2, "0")}
                                            </span>
                                            <span className="flex-1 text-sm font-medium text-slate-800">
                                                {m.nickname}
                                            </span>
                                            <span className="text-sm font-semibold text-slate-800 tabular-nums">
                                                ${m.total_debt.toLocaleString()}
                                            </span>
                                            <span className="ml-3 text-slate-300 text-sm">›</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                                <span>共 {debtors.length} 位</span>
                                <span>合計 ${data.outstanding_debt.toLocaleString()}</span>
                            </div>
                        </>
                    )}
                </Panel>

                <Panel title="即將補貨" hint="庫存 ≤ 5">
                    {(data.low_stock || []).length === 0 ? (
                        <EmptyState>庫存都還算足夠</EmptyState>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {data.low_stock.map(p => (
                                <li key={p.id} className="flex items-center py-2.5">
                                    <span className="flex-1 text-sm font-medium text-slate-800">{p.name}</span>
                                    <span className={`text-sm font-semibold tabular-nums ${p.stock <= 2 ? "text-red-600" : "text-slate-700"}`}>
                                        剩 {p.stock} 件
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </div>
    );
}

function KpiCard({ label, value, suffix, tone }) {
    const style = {
        primary: "bg-green-600 text-white border-green-600",
        warn: "bg-white border-red-200",
        default: "bg-white border-slate-200",
    }[tone || "default"];

    const valueColor = tone === "primary" ? "text-white" : tone === "warn" ? "text-red-600" : "text-slate-800";
    const labelColor = tone === "primary" ? "text-green-100" : "text-slate-500";
    const suffixColor = tone === "primary" ? "text-green-100" : "text-slate-400";

    return (
        <div className={`rounded-2xl p-4 border shadow-sm ${style}`}>
            <div className={`text-xs font-medium tracking-wide ${labelColor}`}>{label}</div>
            <div className="mt-2 flex items-baseline gap-1">
                <span className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</span>
                {suffix && <span className={`text-xs ${suffixColor}`}>{suffix}</span>}
            </div>
        </div>
    );
}

function Panel({ title, hint, children }) {
    return (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
                {hint && <span className="text-xs text-slate-400">{hint}</span>}
            </div>
            {children}
        </div>
    );
}

function EmptyState({ children }) {
    return <div className="py-6 text-center text-sm text-slate-400">{children}</div>;
}

function ErrorBox({ message }) {
    return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-red-800">無法載入資料</div>
            <div className="text-xs text-red-700 mt-1">{message}</div>
        </div>
    );
}

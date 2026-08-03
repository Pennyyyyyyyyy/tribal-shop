import React, { useEffect, useState } from "react";
import * as api from "../../service/adminApi";

// 取台灣今日 YYYY-MM-DD（Intl 的 sv-SE 剛好給我們 ISO 樣式）。
function taipeiToday() {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}
// 台灣本月 1 號 YYYY-MM-01
function taipeiMonthStart() {
    return taipeiToday().slice(0, 7) + "-01";
}

const timeFmt = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
});

export default function ConsignorsPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewing, setViewing] = useState(null);

    async function load() {
        setLoading(true);
        try {
            const list = await api.consignors.list();
            list.sort((a, b) => (b.total_gross || 0) - (a.total_gross || 0));
            setItems(list);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-xl font-semibold text-slate-800">寄賣者</h2>
                <p className="text-xs text-slate-500 mt-0.5">按累計銷售由高到低</p>
            </div>

            {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-sm text-slate-500">載入中…</div>
                ) : items.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                        還沒有寄賣族人。族人加 LINE bot 後會自動註冊；也可在 Supabase SQL 手動加 users (role='consignor')。
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {items.map((c, i) => {
                            const total = c.total_gross || 0;
                            const unpaid = c.unpaid_gross || 0;
                            return (
                                <li key={c.line_id} className="flex items-center px-4 py-3 hover:bg-slate-50 transition-colors">
                                    <span className="w-9 text-xs text-slate-400 tabular-nums font-medium">
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <span className="flex-1 text-sm font-medium text-slate-800">
                                        {c.nickname || <span className="text-slate-400">（未命名）</span>}
                                    </span>
                                    <span className="w-32 text-right text-sm tabular-nums text-slate-800">
                                        ${total.toLocaleString()}
                                    </span>
                                    <span className={
                                        "w-32 text-right text-sm tabular-nums " +
                                        (unpaid > 0 ? "text-orange-600 font-semibold" : "text-slate-400")
                                    }>
                                        {unpaid > 0 ? `$${unpaid.toLocaleString()}` : "—"}
                                    </span>
                                    <button
                                        onClick={() => setViewing(c)}
                                        className="ml-4 text-xs text-slate-500 hover:text-green-700 font-medium"
                                    >
                                        查看明細
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {viewing && (
                <SalesDetailModal
                    consignor={viewing}
                    onClose={() => setViewing(null)}
                />
            )}
        </div>
    );
}

function SalesDetailModal({ consignor, onClose }) {
    const [from, setFrom] = useState(taipeiMonthStart());
    const [to, setTo] = useState(taipeiToday());
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    async function fetchSales(rangeFrom, rangeTo) {
        setLoading(true);
        setError(null);
        try {
            const data = await api.consignors.detail(consignor.line_id, { from: rangeFrom, to: rangeTo });
            setSales(data.sales || []);
        } catch (err) {
            setError(err.message);
            setSales([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchSales(from, to); }, []); // 首次以預設區間

    function query() {
        fetchSales(from, to);
    }

    const totalSum = sales.reduce((s, x) => s + (x.subtotal || 0), 0);

    return (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-6" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-base font-semibold text-slate-800 pb-3 border-b border-slate-200">
                    {consignor.nickname || "（未命名）"} 的銷售明細
                </h3>

                <div className="mt-4 flex items-end gap-2 flex-wrap">
                    <label className="block">
                        <span className="text-xs font-medium text-slate-600 mb-1 block">起</span>
                        <input
                            type="date"
                            value={from}
                            onChange={e => setFrom(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm tabular-nums"
                        />
                    </label>
                    <label className="block">
                        <span className="text-xs font-medium text-slate-600 mb-1 block">迄</span>
                        <input
                            type="date"
                            value={to}
                            onChange={e => setTo(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm tabular-nums"
                        />
                    </label>
                    <button
                        onClick={query}
                        disabled={loading}
                        className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-slate-300 text-white text-sm font-semibold shadow-sm transition-colors"
                    >
                        {loading ? "查詢中…" : "查詢"}
                    </button>
                </div>

                {error && (
                    <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {error}
                    </div>
                )}

                <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center text-sm text-slate-500">載入中…</div>
                    ) : sales.length === 0 ? (
                        <div className="p-10 text-center text-sm text-slate-500">此期間無銷售</div>
                    ) : (
                        <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                                        <th className="px-4 py-2.5 font-medium">商品</th>
                                        <th className="px-4 py-2.5 font-medium">時間</th>
                                        <th className="px-4 py-2.5 font-medium text-right">金額</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sales.map((s, i) => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-2.5 text-slate-800">
                                                {s.product_name} × {s.quantity}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-600 tabular-nums">
                                                {timeFmt.format(new Date(s.transaction_created_at))}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-800">
                                                ${(s.subtotal || 0).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                        總銷售 <span className="font-semibold tabular-nums text-slate-800">${totalSum.toLocaleString()}</span>
                        <span className="text-slate-400"> · 共 {sales.length} 筆</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium"
                    >
                        關閉
                    </button>
                </div>
            </div>
        </div>
    );
}

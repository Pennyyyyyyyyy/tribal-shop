import React, { useEffect, useMemo, useState } from "react";
import * as api from "../../service/adminApi";

const PENDING_DEBTOR = "待確認族人";

// 台灣時區 YYYY-MM-DD（daysOffset 可傳負值代表往前推）
function taipeiDate(daysOffset = 0) {
    const d = new Date(Date.now() + daysOffset * 24 * 3600 * 1000);
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(d);
    const y = parts.find(p => p.type === "year").value;
    const m = parts.find(p => p.type === "month").value;
    const dd = parts.find(p => p.type === "day").value;
    return `${y}-${m}-${dd}`;
}

export default function TransactionsPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // 預設：最近一個月（30 天）
    const [from, setFrom] = useState(() => taipeiDate(-30));
    const [to, setTo] = useState(() => taipeiDate(0));
    const [viewing, setViewing] = useState(null);
    const [assigning, setAssigning] = useState(null);

    // 可傳 fromArg / toArg 覆蓋 state（給快捷區間 button 用，避開 React
    // setState 非同步讀到舊 closure state 導致要按兩次才對的 bug）。
    async function load(fromArg, toArg) {
        const f = fromArg !== undefined ? fromArg : from;
        const t = toArg !== undefined ? toArg : to;
        setLoading(true);
        try {
            setItems(await api.transactions.list({ from: f || undefined, to: t || undefined }));
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    // 小計：現金 + 賒帳分開，配上總筆數
    const totals = useMemo(() => {
        let cash = 0, credit = 0, pending = 0;
        for (const tx of items) {
            const t = tx.total || 0;
            if (tx.type === "credit") {
                credit += t;
                if (tx.identity === PENDING_DEBTOR) pending += 1;
            } else {
                cash += t;
            }
        }
        return { cash, credit, pending, total: cash + credit, count: items.length };
    }, [items]);

    function setQuickRange(days) {
        const nf = taipeiDate(-days);
        const nt = taipeiDate(0);
        setFrom(nf);
        setTo(nt);
        load(nf, nt);   // 直接用新值查，不等 React re-render
    }

    return (
        <div className="space-y-5">
            <div className="flex items-end justify-between flex-wrap gap-3">
                <h2 className="text-xl font-semibold text-slate-800">交易紀錄</h2>
                <div className="flex items-end gap-2 flex-wrap">
                    <div className="flex items-center gap-1 border border-slate-200 rounded-xl bg-white px-1 py-1">
                        {[
                            { label: "今天", days: 0 },
                            { label: "7 天", days: 7 },
                            { label: "30 天", days: 30 },
                            { label: "90 天", days: 90 },
                        ].map(r => (
                            <button
                                key={r.label}
                                onClick={() => setQuickRange(r.days)}
                                disabled={loading}
                                className="px-3 py-1 rounded-lg text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-wait transition-colors"
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <DateInput label="從" value={from} onChange={setFrom} />
                    <DateInput label="到" value={to} onChange={setTo} />
                    <button
                        onClick={load}
                        className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold shadow-sm transition-colors"
                    >
                        查詢
                    </button>
                </div>
            </div>

            {/* 小計列 */}
            {!loading && items.length > 0 && (
                <div className="flex items-center flex-wrap gap-x-6 gap-y-1 bg-white rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-600">
                    <span>共 <span className="font-semibold text-slate-800 tabular-nums">{totals.count}</span> 筆</span>
                    <span>合計 <span className="font-semibold text-slate-800 tabular-nums">${totals.total.toLocaleString()}</span></span>
                    <span className="text-slate-400">·</span>
                    <span>現金 <span className="font-semibold text-slate-800 tabular-nums">${totals.cash.toLocaleString()}</span></span>
                    <span>賒帳 <span className="font-semibold text-slate-800 tabular-nums">${totals.credit.toLocaleString()}</span></span>
                    {totals.pending > 0 && (
                        <span className="ml-auto text-orange-700">
                            尚有 <span className="font-semibold tabular-nums">{totals.pending}</span> 筆待指認族人
                        </span>
                    )}
                </div>
            )}

            {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-sm text-slate-500">載入中…</div>
                ) : items.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">這段時間沒有交易紀錄</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                                <Th>時間</Th>
                                <Th>類型</Th>
                                <Th>對象</Th>
                                <Th className="text-right">金額</Th>
                                <Th></Th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map(tx => {
                                const pending = tx.type === "credit" && tx.identity === PENDING_DEBTOR;
                                return (
                                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                        <Td className="text-slate-600 tabular-nums text-xs">{formatDateTime(tx.created_at)}</Td>
                                        <Td><TypePill type={tx.type} /></Td>
                                        <Td>
                                            {pending ? (
                                                <span className="text-orange-700 font-medium">{tx.identity}</span>
                                            ) : (
                                                <span className="font-medium text-slate-800">{tx.identity || "—"}</span>
                                            )}
                                        </Td>
                                        <Td className="text-right font-semibold tabular-nums text-slate-800">
                                            ${(tx.total || 0).toLocaleString()}
                                        </Td>
                                        <Td className="text-right">
                                            <div className="flex justify-end gap-3">
                                                {pending && (
                                                    <button
                                                        onClick={() => setAssigning(tx)}
                                                        className="text-xs text-orange-700 hover:text-orange-900 font-semibold"
                                                    >
                                                        指認族人
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setViewing(tx)}
                                                    className="text-xs text-green-700 hover:text-green-900 font-medium"
                                                >
                                                    查看
                                                </button>
                                            </div>
                                        </Td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {viewing && <TransactionModal tx={viewing} onClose={() => setViewing(null)} />}
            {assigning && (
                <AssignDebtorModal
                    tx={assigning}
                    onClose={() => setAssigning(null)}
                    onDone={() => { setAssigning(null); load(); }}
                />
            )}
        </div>
    );
}

function DateInput({ label, value, onChange }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500 ml-1">{label}</span>
            <input
                type="date"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm"
            />
        </label>
    );
}

function Th({ children, className = "" }) {
    return <th className={`px-4 py-2.5 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
    return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function TypePill({ type }) {
    if (type === "credit") {
        return <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">賒帳</span>;
    }
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">現金</span>;
}

function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
    });
}

// ─── Modals ─────────────────────────────────────────────────────
function TransactionModal({ tx, onClose }) {
    const items = safeParseItems(tx.item_list);

    return (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-6" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 space-y-5">
                    <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                        <div>
                            <div className="text-[11px] text-slate-500 uppercase tracking-wider">交易 #{tx.id}</div>
                            <h3 className="text-lg font-semibold text-slate-800 mt-0.5">{tx.identity || "—"}</h3>
                            <div className="text-xs text-slate-500 mt-1">{formatDateTime(tx.created_at)}</div>
                        </div>
                        <div className="text-right">
                            <TypePill type={tx.type} />
                            <div className="mt-2 text-xl font-bold tabular-nums text-slate-800">
                                ${(tx.total || 0).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="text-xs font-semibold text-slate-600 mb-2">明細</div>
                        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                            {items.length === 0 ? (
                                <div className="p-3 text-center text-sm text-slate-400">無明細</div>
                            ) : items.map((it, i) => (
                                <div key={i} className="flex items-center px-3 py-2 text-sm">
                                    <span className="flex-1 text-slate-800">{it.name}</span>
                                    <span className="w-14 text-right text-slate-500 tabular-nums text-xs">×{it.quantity || 1}</span>
                                    <span className="w-20 text-right font-semibold text-slate-800 tabular-nums">
                                        ${((it.price || 0) * (it.quantity || 1)).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {tx.checkout_image && (
                        <div>
                            <div className="text-xs font-semibold text-slate-600 mb-2">存證照片</div>
                            <img
                                src={tx.checkout_image}
                                alt="checkout evidence"
                                className="w-full max-h-80 object-contain rounded-xl border border-slate-200 bg-slate-50"
                            />
                        </div>
                    )}

                    <div className="pt-2 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium"
                        >
                            關閉
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AssignDebtorModal({ tx, onClose, onDone }) {
    const [members, setMembers] = useState(null);
    const [filter, setFilter] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.members.list()
            .then(list => setMembers(list.sort((a, b) => a.nickname.localeCompare(b.nickname))))
            .catch(err => setError(err.message));
    }, []);

    const filtered = (members || []).filter(m =>
        !filter || m.nickname.includes(filter)
    );

    async function pick(m) {
        if (!confirm(`確定把「$${tx.total} · ${formatDateTime(tx.created_at)}」這筆賒帳算給「${m.nickname}」？`)) return;
        setBusy(true);
        setError(null);
        try {
            await api.transactions.assignDebtor(tx.id, m.id);
            onDone();
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-6" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 border-b border-slate-200">
                    <h3 className="text-base font-semibold text-slate-800">指認族人</h3>
                    <div className="mt-1.5 text-xs text-slate-500">
                        交易 #{tx.id} · {formatDateTime(tx.created_at)} · <span className="font-semibold text-slate-700 tabular-nums">${(tx.total || 0).toLocaleString()}</span>
                    </div>
                </div>

                <div className="p-4">
                    <input
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder="搜尋族人暱稱"
                        autoFocus
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm"
                    />
                </div>

                {error && (
                    <div className="mx-4 mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {error}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-4 pb-4">
                    {members === null ? (
                        <div className="py-4 text-center text-sm text-slate-500">載入族人中…</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-4 text-center text-sm text-slate-500">
                            {filter ? "找不到符合的族人" : "還沒有族人資料"}
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                            {filtered.map(m => (
                                <li key={m.id}>
                                    <button
                                        onClick={() => pick(m)}
                                        disabled={busy}
                                        className="w-full flex items-center px-3 py-2.5 hover:bg-slate-50 disabled:opacity-50 text-left text-sm transition-colors"
                                    >
                                        <span className="flex-1 font-medium text-slate-800">{m.nickname}</span>
                                        <span className="text-xs text-slate-500 tabular-nums">
                                            目前欠款 ${((m.total_debt || 0)).toLocaleString()}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
}

function safeParseItems(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return []; }
}

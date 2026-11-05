import React, { useState } from "react";
import { PENDING_DEBTOR, formatDateTime } from "../../utils/adminFormat";
import { useTransactions } from "../../hooks/useTransactions";
import { TypePill, TransactionModal, AssignDebtorModal } from "../../components/admin/transactionsShared";

export default function TransactionsPage() {
    const { items, loading, error, from, setFrom, to, setTo, load, totals, setQuickRange } = useTransactions();
    const [viewing, setViewing] = useState(null);
    const [assigning, setAssigning] = useState(null);

    return (
        <div className="flex flex-col gap-5">
            <h1 className="font-display text-[38px]">交易紀錄</h1>

            <div className="flex gap-2.5 items-center flex-wrap">
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
                        className="focus-ring pill hover:border-clay disabled:opacity-40 disabled:cursor-wait"
                    >
                        {r.label}
                    </button>
                ))}
                <DateInput label="從" value={from} onChange={setFrom} />
                <DateInput label="到" value={to} onChange={setTo} />
                <button
                    onClick={() => load()}
                    className="btn-press h-11 px-5 rounded-[14px] shadow-press-sm bg-forest text-paper text-lg"
                >
                    查詢
                </button>
            </div>

            {/* 小計列 */}
            {!loading && items.length > 0 && (
                <div className="flex items-center flex-wrap gap-x-6 gap-y-1 text-base">
                    <span>共 <b className="font-display text-2xl tabular-nums">{totals.count}</b> 筆</span>
                    <span>合計 <b className="font-display text-2xl text-forest tabular-nums">NT${totals.total.toLocaleString()}</b></span>
                    <span>現金 NT${totals.cash.toLocaleString()}</span>
                    <span>賒帳 NT${totals.credit.toLocaleString()}</span>
                    {totals.pending > 0 && (
                        <span className="ml-auto chip bg-peach">
                            尚有 <span className="tabular-nums">{totals.pending}</span> 筆待指認居民
                        </span>
                    )}
                </div>
            )}

            {error && (
                <div role="alert" className="border-2 border-clay bg-peach rounded-2xl px-4 py-2.5 text-[15px]">
                    {error}
                </div>
            )}

            <section className="panel overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-base opacity-70">載入中…</div>
                ) : items.length === 0 ? (
                    <div className="p-10 text-center text-base opacity-70">這段時間沒有交易紀錄</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table min-w-[640px]">
                            <thead>
                                <tr>
                                    <th>時間</th>
                                    <th>類型</th>
                                    <th>對象</th>
                                    <th className="text-right">金額</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(tx => {
                                    const pending = tx.type === "credit" && tx.identity === PENDING_DEBTOR;
                                    return (
                                        <tr key={tx.id} className={pending ? "bg-peach/40" : "hover:bg-cream transition-colors"}>
                                            <td className="tabular-nums">{formatDateTime(tx.created_at)}</td>
                                            <td><TypePill type={tx.type} /></td>
                                            <td className="font-bold">{tx.identity || "—"}</td>
                                            <td className="text-right tabular-nums font-display text-xl">
                                                NT${(tx.total || 0).toLocaleString()}
                                            </td>
                                            <td className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {pending && (
                                                        <button
                                                            onClick={() => setAssigning(tx)}
                                                            className="btn-press h-[38px] px-3.5 rounded-xl border-2 shadow-[0_3px_0_#4A2C1A] bg-clay text-paper text-[15px]"
                                                        >
                                                            指認居民
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setViewing(tx)}
                                                        className="btn-ghost h-[38px] px-4 rounded-xl text-[15px]"
                                                    >
                                                        明細
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

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
        <label className="flex items-center gap-2">
            <span className="text-base font-bold ml-1">{label}</span>
            <input
                type="date"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="field h-11 w-auto text-base bg-paper rounded-[14px] px-3"
            />
        </label>
    );
}

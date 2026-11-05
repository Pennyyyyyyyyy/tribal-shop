import React, { useState } from "react";
import { useTransactions } from "../../../hooks/useTransactions";
import { PENDING_DEBTOR, formatDateTime, safeParseItems } from "../../../utils/adminFormat";
import { TypePill, TransactionModal, AssignDebtorModal } from "../../../components/admin/transactionsShared";
import { PageHeader, Card, PillRow, Pill, Loading, Empty } from "../../../components/admin/mobile/mobileShared";

const RANGES = [
    { label: "今天", days: 0 },
    { label: "7 天", days: 7 },
    { label: "30 天", days: 30 },
    { label: "90 天", days: 90 },
];

export default function TransactionsMobile() {
    const { items, loading, error, from, setFrom, to, setTo, load, totals, setQuickRange } = useTransactions();
    // 預設區間跟 useTransactions 一致（30 天）；"custom" = 自訂日期
    const [range, setRange] = useState(30);
    const [viewing, setViewing] = useState(null);
    const [assigning, setAssigning] = useState(null);

    function pickRange(days) {
        setRange(days);
        setQuickRange(days);
    }

    return (
        <div className="flex flex-col gap-3.5">
            <PageHeader title="交易紀錄" />

            <PillRow>
                {RANGES.map(r => (
                    <Pill key={r.label} on={range === r.days} onClick={() => pickRange(r.days)}>{r.label}</Pill>
                ))}
                <Pill on={range === "custom"} onClick={() => setRange("custom")}>自訂日期</Pill>
            </PillRow>

            {range === "custom" && (
                <div className="panel p-3.5 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2.5">
                        <label className="min-w-0">
                            <span className="text-sm font-bold">從</span>
                            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="field h-12 mt-1 px-2 text-base" />
                        </label>
                        <label className="min-w-0">
                            <span className="text-sm font-bold">到</span>
                            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="field h-12 mt-1 px-2 text-base" />
                        </label>
                    </div>
                    <button onClick={() => load()} className="btn-press h-12 rounded-2xl shadow-press-sm bg-forest text-paper text-lg">
                        查詢
                    </button>
                </div>
            )}

            {!loading && items.length > 0 && (
                <div className="panel px-3.5 py-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                    <span>共 <b className="font-display font-normal text-xl tabular-nums">{totals.count}</b> 筆</span>
                    <span>合計 <b className="font-display font-normal text-xl text-forest tabular-nums">NT${totals.total.toLocaleString()}</b></span>
                    <span>現金 NT${totals.cash.toLocaleString()}</span>
                    <span>賒帳 NT${totals.credit.toLocaleString()}</span>
                    {totals.pending > 0 && (
                        <span className="col-span-2 chip bg-peach justify-self-start">
                            尚有 <span className="tabular-nums">{totals.pending}</span> 筆待指認居民
                        </span>
                    )}
                </div>
            )}

            {error && (
                <div role="alert" className="border-2 border-clay bg-peach rounded-2xl px-4 py-2.5 text-[15px]">{error}</div>
            )}

            {loading ? <Loading /> : items.length === 0 ? (
                <Empty>這段時間沒有交易紀錄</Empty>
            ) : items.map(tx => {
                const pending = tx.type === "credit" && tx.identity === PENDING_DEBTOR;
                return pending ? (
                    <PendingCard key={tx.id} tx={tx} onAssign={() => setAssigning(tx)} />
                ) : (
                    <button
                        key={tx.id}
                        onClick={() => setViewing(tx)}
                        className="focus-ring text-left bg-paper border-2 border-ink rounded-[18px] px-3.5 py-3 min-h-[52px] flex items-center gap-2.5"
                    >
                        <TxSummary tx={tx} />
                    </button>
                );
            })}

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

function TxSummary({ tx, nameClass = "" }) {
    return (
        <>
            <span className="font-display text-[15px] tabular-nums whitespace-nowrap shrink-0">{formatDateTime(tx.created_at)}</span>
            <TypePill type={tx.type} />
            <span className={`flex-1 min-w-0 truncate font-bold text-[15px] ${nameClass}`}>{tx.identity || "—"}</span>
            <span className="font-display text-lg tabular-nums shrink-0">NT${(tx.total || 0).toLocaleString()}</span>
        </>
    );
}

// 待指認的賒帳：直接展開照片與明細，讓店長看完就能指認
function PendingCard({ tx, onAssign }) {
    const lines = safeParseItems(tx.item_list);
    return (
        <Card strong className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
                <TxSummary tx={tx} nameClass="text-rust" />
            </div>
            {tx.checkout_image ? (
                <img src={tx.checkout_image} alt="存證照片" className="w-full max-h-56 object-contain rounded-[14px] border-2 border-sand bg-cocoa" />
            ) : (
                <div className="h-[100px] border-2 border-dashed border-sand rounded-[14px] bg-cream flex items-center justify-center text-sm">沒有存證照片</div>
            )}
            <div className="flex flex-col gap-1 text-[15px]">
                {lines.map((it, i) => (
                    <div key={i} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">{it.name} ×{it.quantity || 1}</span>
                        <span className="tabular-nums shrink-0">NT${((it.price || 0) * (it.quantity || 1)).toLocaleString()}</span>
                    </div>
                ))}
            </div>
            <button onClick={onAssign} className="btn-press h-[52px] rounded-2xl shadow-press-sm bg-forest text-paper text-lg">
                指認居民並記入欠款
            </button>
        </Card>
    );
}

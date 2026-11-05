// 交易頁共用：類型標籤、明細彈窗、指認居民彈窗（電腦版與手機版都用）
import React, { useEffect, useState } from "react";
import * as api from "../../service/adminApi";
import { displayIdentity, formatDateTime, safeParseItems } from "../../utils/adminFormat";

export function TypePill({ type }) {
    if (type === "credit") {
        return <span className="chip bg-peach">賒帳</span>;
    }
    return <span className="chip bg-moss">現金</span>;
}

// ─── Modals ─────────────────────────────────────────────────────
export function TransactionModal({ tx, onClose }) {
    const items = safeParseItems(tx.item_list);

    return (
        <div className="fixed inset-0 bg-cocoa/50 flex items-center justify-center z-50 px-4 sm:px-6" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                className="panel shadow-press-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto text-ink"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-7 flex flex-col gap-5">
                    <div className="flex items-start justify-between pb-3 border-b-2 border-dashed border-sand">
                        <div>
                            <div className="text-sm opacity-70">交易 #{tx.id}</div>
                            <h3 className="font-display text-[26px] mt-0.5">{displayIdentity(tx.identity)}</h3>
                            <div className="text-sm mt-1 tabular-nums">{formatDateTime(tx.created_at)}</div>
                        </div>
                        <div className="text-right">
                            <TypePill type={tx.type} />
                            <div className="mt-2 font-display text-[30px] text-forest tabular-nums">
                                NT${(tx.total || 0).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="text-[15px] font-bold mb-2">明細</div>
                        <div className="bg-cream rounded-2xl divide-y-2 divide-wheat">
                            {items.length === 0 ? (
                                <div className="p-3 text-center text-base opacity-60">無明細</div>
                            ) : items.map((it, i) => (
                                <div key={i} className="flex items-center px-4 py-2.5 text-base">
                                    <span className="flex-1">{it.name}</span>
                                    <span className="w-14 text-right tabular-nums">×{it.quantity || 1}</span>
                                    <span className="w-24 text-right font-bold tabular-nums">
                                        NT${((it.price || 0) * (it.quantity || 1)).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {tx.checkout_image && (
                        <div>
                            <div className="text-[15px] font-bold mb-2">存證照片</div>
                            <img
                                src={tx.checkout_image}
                                alt="checkout evidence"
                                className="w-full max-h-80 object-contain rounded-2xl border-[3px] border-ink bg-cocoa"
                            />
                        </div>
                    )}

                    <div className="pt-2 flex justify-end">
                        <button
                            onClick={onClose}
                            className="btn-ghost h-12 px-5 text-base"
                        >
                            關閉
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AssignDebtorModal({ tx, onClose, onDone }) {
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
        <div className="fixed inset-0 bg-cocoa/50 flex items-center justify-center z-50 px-4 sm:px-6" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                className="panel shadow-press-lg w-full max-w-sm max-h-[80vh] flex flex-col text-ink"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b-2 border-dashed border-sand">
                    <h3 className="font-display text-[26px]">指認居民</h3>
                    <div className="mt-1.5 text-sm">
                        交易 #{tx.id} · {formatDateTime(tx.created_at)} · <span className="font-bold tabular-nums">NT${(tx.total || 0).toLocaleString()}</span>
                    </div>
                </div>

                <div className="p-4">
                    <input
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder="搜尋居民暱稱"
                        autoFocus
                        className="field h-12 text-base"
                    />
                </div>

                {error && (
                    <div role="alert" className="mx-4 mb-3 text-[15px] border-2 border-clay bg-peach rounded-[14px] px-3.5 py-2.5">
                        {error}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-4 pb-4">
                    {members === null ? (
                        <div className="py-4 text-center text-base opacity-70">載入居民中…</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-4 text-center text-base opacity-70">
                            {filter ? "找不到符合的居民" : "還沒有居民資料"}
                        </div>
                    ) : (
                        <ul className="divide-y-2 divide-wheat border-2 border-sand rounded-2xl overflow-hidden">
                            {filtered.map(m => (
                                <li key={m.id}>
                                    <button
                                        onClick={() => pick(m)}
                                        disabled={busy}
                                        className="focus-ring w-full flex items-center px-4 py-3 hover:bg-cream disabled:opacity-50 text-left text-base transition-colors"
                                    >
                                        <span className="flex-1 font-bold">{m.nickname}</span>
                                        <span className="text-sm tabular-nums text-rust">
                                            目前欠款 NT${((m.total_debt || 0)).toLocaleString()}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="p-4 border-t-2 border-dashed border-sand flex justify-end">
                    <button
                        onClick={onClose}
                        className="btn-ghost h-12 px-5 text-base"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
}

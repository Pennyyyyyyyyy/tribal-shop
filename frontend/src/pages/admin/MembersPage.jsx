import React, { useEffect, useState } from "react";
import * as api from "../../service/adminApi";

export default function MembersPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [repaying, setRepaying] = useState(null);
    const [editing, setEditing] = useState(null);   // 編輯暱稱
    const [creating, setCreating] = useState(false); // 新增族人

    async function load() {
        setLoading(true);
        try {
            const list = await api.members.list();
            list.sort((a, b) => (b.total_debt || 0) - (a.total_debt || 0));
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
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-slate-800">族人管理</h2>
                    <p className="text-xs text-slate-500 mt-0.5">按未還款金額排序</p>
                </div>
                <button
                    onClick={() => setCreating(true)}
                    className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold shadow-sm transition-colors"
                >
                    新增族人
                </button>
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
                        還沒有族人資料，點右上「新增族人」開始
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {items.map((m, i) => {
                            const debt = m.total_debt || 0;
                            return (
                                <li key={m.id} className="flex items-center px-4 py-3 hover:bg-slate-50 transition-colors">
                                    <span className="w-9 text-xs text-slate-400 tabular-nums font-medium">
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <span className="flex-1 text-sm font-medium text-slate-800">{m.nickname}</span>
                                    <span className={`w-28 text-right text-sm font-semibold tabular-nums ${debt > 0 ? "text-slate-800" : "text-slate-400"}`}>
                                        {debt > 0 ? `$${debt.toLocaleString()}` : "無欠款"}
                                    </span>
                                    <button
                                        onClick={() => setEditing(m)}
                                        className="ml-4 text-xs text-slate-500 hover:text-green-700 font-medium"
                                    >
                                        編輯
                                    </button>
                                    <button
                                        onClick={() => setRepaying(m)}
                                        disabled={debt === 0}
                                        className="ml-3 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-semibold shadow-sm transition-colors"
                                    >
                                        還款
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {repaying && (
                <RepayModal
                    member={repaying}
                    onClose={() => setRepaying(null)}
                    onDone={() => { setRepaying(null); load(); }}
                />
            )}
            {editing && (
                <EditNicknameModal
                    member={editing}
                    onClose={() => setEditing(null)}
                    onDone={() => { setEditing(null); load(); }}
                />
            )}
            {creating && (
                <CreateMemberModal
                    onClose={() => setCreating(false)}
                    onDone={() => { setCreating(false); load(); }}
                />
            )}
        </div>
    );
}

function RepayModal({ member, onClose, onDone }) {
    const [amount, setAmount] = useState("");
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    async function submit(e) {
        e.preventDefault();
        const n = parseInt(amount);
        if (isNaN(n) || n <= 0) {
            setError("請輸入正整數");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await api.members.repay(member.id, n);
            onDone();
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <ModalShell onClose={onClose}>
            <form onSubmit={submit}>
                <h3 className="text-base font-semibold text-slate-800 pb-3 border-b border-slate-200">
                    記錄還款
                </h3>

                <dl className="mt-5 space-y-1.5 text-sm">
                    <Row label="族人" value={<span className="font-medium">{member.nickname}</span>} />
                    <Row label="目前欠款" value={<span className="font-semibold tabular-nums">${(member.total_debt || 0).toLocaleString()}</span>} />
                </dl>

                <label className="block mt-5">
                    <span className="text-xs font-medium text-slate-600 mb-1.5 block">還款金額 NT$</span>
                    <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        autoFocus
                        placeholder="0"
                        className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-xl font-bold tabular-nums text-center"
                    />
                </label>

                {error && <ErrorLine>{error}</ErrorLine>}

                <FooterButtons
                    onCancel={onClose}
                    submitLabel={busy ? "記錄中…" : "確認還款"}
                    submitDisabled={busy || !amount}
                />
            </form>
        </ModalShell>
    );
}

function EditNicknameModal({ member, onClose, onDone }) {
    const [nickname, setNickname] = useState(member.nickname || "");
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    async function submit(e) {
        e.preventDefault();
        const value = nickname.trim();
        if (!value) { setError("暱稱不能空白"); return; }
        if (value === member.nickname) { onClose(); return; }
        setBusy(true);
        setError(null);
        try {
            await api.members.update(member.id, { nickname: value });
            onDone();
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <ModalShell onClose={onClose}>
            <form onSubmit={submit}>
                <h3 className="text-base font-semibold text-slate-800 pb-3 border-b border-slate-200">
                    編輯族人
                </h3>

                <label className="block mt-5">
                    <span className="text-xs font-medium text-slate-600 mb-1.5 block">暱稱</span>
                    <input
                        value={nickname}
                        onChange={e => setNickname(e.target.value)}
                        autoFocus
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-base"
                    />
                </label>

                <p className="mt-2 text-xs text-slate-500">
                    改名不影響既有欠款與交易紀錄。
                </p>

                {error && <ErrorLine>{error}</ErrorLine>}

                <FooterButtons
                    onCancel={onClose}
                    submitLabel={busy ? "儲存中…" : "儲存"}
                    submitDisabled={busy || !nickname.trim()}
                />
            </form>
        </ModalShell>
    );
}

function CreateMemberModal({ onClose, onDone }) {
    const [nickname, setNickname] = useState("");
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    async function submit(e) {
        e.preventDefault();
        const value = nickname.trim();
        if (!value) { setError("暱稱不能空白"); return; }
        setBusy(true);
        setError(null);
        try {
            await api.members.create({ nickname: value });
            onDone();
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <ModalShell onClose={onClose}>
            <form onSubmit={submit}>
                <h3 className="text-base font-semibold text-slate-800 pb-3 border-b border-slate-200">
                    新增族人
                </h3>

                <label className="block mt-5">
                    <span className="text-xs font-medium text-slate-600 mb-1.5 block">暱稱</span>
                    <input
                        value={nickname}
                        onChange={e => setNickname(e.target.value)}
                        autoFocus
                        placeholder="例：王媽媽"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-base"
                    />
                </label>

                <p className="mt-2 text-xs text-slate-500">
                    新族人預設欠款 0。之後如加入 LINE Bot，會沿用同一筆紀錄。
                </p>

                {error && <ErrorLine>{error}</ErrorLine>}

                <FooterButtons
                    onCancel={onClose}
                    submitLabel={busy ? "建立中…" : "建立"}
                    submitDisabled={busy || !nickname.trim()}
                />
            </form>
        </ModalShell>
    );
}

// ─── shared modal chrome ─────────────────────────────────────────
function ModalShell({ onClose, children }) {
    return (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-6" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
                onClick={e => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div className="flex justify-between text-sm">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-slate-800">{value}</dd>
        </div>
    );
}

function ErrorLine({ children }) {
    return (
        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {children}
        </div>
    );
}

function FooterButtons({ onCancel, submitLabel, submitDisabled }) {
    return (
        <div className="mt-6 flex justify-end gap-2">
            <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium"
            >
                取消
            </button>
            <button
                type="submit"
                disabled={submitDisabled}
                className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-slate-300 text-white text-sm font-semibold shadow-sm"
            >
                {submitLabel}
            </button>
        </div>
    );
}

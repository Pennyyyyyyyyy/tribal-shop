// 居民頁共用：還款表單、編輯暱稱、新增居民（電腦版與手機版都用）
import React, { useState } from "react";
import * as api from "../../service/adminApi";
import { ModalShell, ErrorLine, FooterButtons } from "./adminShared";

export function RepayPanel({ member, onClose, onDone }) {
    const [amount, setAmount] = useState("");
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const debt = member.total_debt || 0;
    const n = parseInt(amount);
    const remaining = isNaN(n) ? null : debt - n;

    async function submit(e) {
        e.preventDefault();
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
        <form onSubmit={submit} className="flex flex-col gap-3.5">
            <h2 className="font-display text-[26px]">{member.nickname} 還款</h2>
            <div className="flex justify-between items-baseline bg-peach rounded-2xl px-[18px] py-3.5">
                <span className="font-bold">目前欠款</span>
                <span className="font-display text-[30px] tabular-nums">NT${debt.toLocaleString()}</span>
            </div>

            <label htmlFor="repay-amount" className="font-bold text-[15px]">還款金額 NT$</label>
            <input
                id="repay-amount"
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                autoFocus
                placeholder="0"
                className="field font-display text-[22px] tabular-nums"
            />
            {remaining !== null && n > 0 && (
                <div className="text-[15px]">
                    {remaining >= 0 ? `還款後剩 NT$${remaining.toLocaleString()}` : `超過欠款 NT$${(-remaining).toLocaleString()}`}
                </div>
            )}

            {error && <ErrorLine>{error}</ErrorLine>}

            <button
                type="submit"
                disabled={busy || !amount}
                className="btn-press mt-1 h-14 rounded-2xl shadow-press-sm bg-forest text-paper text-xl"
            >
                {busy ? "記錄中…" : "確認還款"}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost h-12 text-base">
                取消
            </button>
        </form>
    );
}

export function EditNicknameModal({ member, onClose, onDone }) {
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
                <h3 className="font-display text-[26px] pb-3 border-b-2 border-dashed border-sand">
                    編輯居民
                </h3>

                <label className="block mt-5">
                    <span className="text-[15px] font-bold mb-1.5 block">暱稱</span>
                    <input
                        value={nickname}
                        onChange={e => setNickname(e.target.value)}
                        autoFocus
                        className="field"
                    />
                </label>

                <p className="mt-2 text-sm opacity-75">
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

export function CreateMemberModal({ onClose, onDone }) {
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
                <h3 className="font-display text-[26px] pb-3 border-b-2 border-dashed border-sand">
                    新增居民
                </h3>

                <label className="block mt-5">
                    <span className="text-[15px] font-bold mb-1.5 block">暱稱</span>
                    <input
                        value={nickname}
                        onChange={e => setNickname(e.target.value)}
                        autoFocus
                        placeholder="例：王媽媽"
                        className="field"
                    />
                </label>

                <p className="mt-2 text-sm opacity-75">
                    新居民預設欠款 0。之後如加入 LINE Bot，會沿用同一筆紀錄。
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

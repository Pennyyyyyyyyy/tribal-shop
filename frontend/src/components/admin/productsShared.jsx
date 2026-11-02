// 商品頁共用元件 —— 店內商品頁 (/admin/products) 與寄賣商品頁 (/admin/consignment-products)
// 兩邊都用到的 UI 塊；state / 資料流各自維護在 page 檔內。
import React, { useState } from "react";
import * as api from "../../service/adminApi";

export const CATEGORIES = ["零食", "玩具", "日用品", "特色商品", "調味料", "泡麵"];

export function Th({ children, className = "" }) {
    return <th className={className}>{children}</th>;
}

export function Td({ children, className = "" }) {
    return <td className={className}>{children}</td>;
}

// 可點擊排序的 header — 顯示 ↑ / ↓ 表示當前排序欄與方向。
export function SortableTh({ sortKey, sort, onSort, align = "left", children }) {
    const active = sort.key === sortKey;
    const arrow = active ? (sort.dir === "asc" ? "↑" : "↓") : "";
    return (
        <th className={align === "right" ? "text-right" : ""}>
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className={
                    "focus-ring inline-flex items-center gap-1 rounded font-bold transition-colors " +
                    (active ? "text-clay" : "hover:text-clay")
                }
            >
                {children}
                <span className="text-xs w-2 inline-block">{arrow}</span>
            </button>
        </th>
    );
}

export function StatusPill({ trained }) {
    return trained
        ? <span className="chip bg-moss">已訓練</span>
        : <span className="chip bg-sand">未訓練</span>;
}

// 審核徽章 —— 綠=已上架、琥珀=待審核、紅=已駁回（hover 顯示原因）。
export function ApprovalPill({ status, reason }) {
    if (status === "pending") {
        return <span className="chip bg-peach">待審核</span>;
    }
    if (status === "rejected") {
        return <span title={reason || "已駁回"} className="chip bg-sand line-through decoration-2 cursor-help">已駁回</span>;
    }
    return <span className="chip bg-moss">已上架</span>;
}

export function ActiveSwitch({ active, onToggle }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={onToggle}
            title={active ? "上架中，點擊下架" : "已下架，點擊上架"}
            className={
                "focus-ring relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors " +
                (active ? "bg-forest" : "bg-sand")
            }
        >
            <span
                className={
                    "inline-block h-5 w-5 transform rounded-full bg-paper transition-transform " +
                    (active ? "translate-x-6" : "translate-x-1")
                }
            />
        </button>
    );
}

export function ErrorBar({ message, onDismiss }) {
    return (
        <div role="alert" className="flex items-center justify-between border-2 border-clay bg-peach rounded-2xl px-4 py-2.5">
            <span className="text-[15px]">{message}</span>
            <button onClick={onDismiss} aria-label="關閉錯誤訊息" className="focus-ring rounded px-1 font-bold">✕</button>
        </div>
    );
}

// 建立 / 編輯商品 Modal。可切換成寄賣商品（帶入 consignor_line_id）。
// consignors 為空陣列 → 寄賣切換仍可勾但下拉是空的（此頁應在切換後禁存）。
export function ProductModal({ product, consignors = [], onClose, onSaved, onDeleted }) {
    const isNew = !product;
    const [initial] = useState(() => ({
        name: product?.name || "",
        price: product?.price ?? "",
        category: product?.category || CATEGORIES[0],
        stock: product?.stock ?? 0,
        is_active: product ? product.is_active !== false : true,
        consignor_line_id: product?.consignor_line_id || null,
    }));
    const [form, setForm] = useState(initial);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    async function save() {
        setBusy(true);
        setError(null);
        try {
            if (isNew) await api.products.create(form);
            else {
                // 只送有改的欄位：沒動庫存就不送 stock，避免把編輯期間 POS 賣掉的數量蓋回去
                const changed = {};
                for (const key of Object.keys(form)) {
                    if (String(form[key] ?? "") !== String(initial[key] ?? "")) changed[key] = form[key];
                }
                if (Object.keys(changed).length > 0) await api.products.update(product.id, changed);
            }
            onSaved();
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    async function remove() {
        if (!confirm(`確定刪除「${product.name}」？`)) return;
        setBusy(true);
        try {
            await api.products.remove(product.id);
            onDeleted();
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
                className="panel shadow-press-lg w-full max-w-md max-h-[90dvh] overflow-y-auto p-6 sm:p-7 text-ink"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="font-display text-[26px] pb-3 border-b-2 border-dashed border-sand">
                    {isNew ? "新增商品" : "編輯商品"}
                </h3>

                <div className="space-y-4 mt-5">
                    <Field label="名稱">
                        <input
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            autoFocus
                            className="field h-12 text-base"
                        />
                    </Field>
                    <Field label="分類">
                        <select
                            value={form.category}
                            onChange={e => setForm({ ...form, category: e.target.value })}
                            className="field h-12 text-base"
                        >
                            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="單價 NT$">
                            <input
                                type="number"
                                value={form.price}
                                onChange={e => setForm({ ...form, price: e.target.value })}
                                className="field h-12 text-base font-bold tabular-nums"
                            />
                        </Field>
                        <Field label="庫存">
                            <input
                                type="number"
                                value={form.stock}
                                onChange={e => setForm({ ...form, stock: e.target.value })}
                                className="field h-12 text-base font-bold tabular-nums"
                            />
                        </Field>
                    </div>
                    <label className="flex items-center gap-2 mt-1 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={e => setForm({ ...form, is_active: e.target.checked })}
                            className="w-5 h-5 accent-forest"
                        />
                        <span className="text-base">上架（顧客 POS 看得到）</span>
                    </label>

                    <div className="border-t-2 border-dashed border-sand pt-4 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!form.consignor_line_id}
                                onChange={e => setForm({
                                    ...form,
                                    consignor_line_id: e.target.checked
                                        ? (consignors[0]?.line_id || null)
                                        : null,
                                })}
                                className="w-5 h-5 accent-clay"
                            />
                            <span className="text-base">寄賣商品（非店家自營）</span>
                        </label>
                        {form.consignor_line_id && (
                            <div className="mt-3 pl-6">
                                <span className="text-sm font-bold mb-1.5 block">寄賣族人</span>
                                <select
                                    value={form.consignor_line_id}
                                    onChange={e => setForm({ ...form, consignor_line_id: e.target.value })}
                                    className="field h-12 text-base"
                                >
                                    {consignors.length === 0 && <option value="">（尚無寄賣族人 — 請先請對方加 LINE bot 或在 SQL 建）</option>}
                                    {consignors.map(c => (
                                        <option key={c.line_id} value={c.line_id}>{c.nickname}（{c.line_id}）</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <div role="alert" className="mt-4 text-[15px] border-2 border-clay bg-peach rounded-[14px] px-3.5 py-2.5">
                        {error}
                    </div>
                )}

                <div className="mt-6 flex items-center justify-between">
                    {!isNew ? (
                        <button
                            onClick={remove}
                            disabled={busy}
                            className="focus-ring rounded text-sm text-clay font-bold underline"
                        >
                            刪除商品
                        </button>
                    ) : <span />}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="btn-ghost h-12 px-5 text-base"
                        >
                            取消
                        </button>
                        <button
                            onClick={save}
                            disabled={busy || !form.name}
                            className="btn-press h-12 px-6 shadow-press-sm rounded-2xl bg-forest text-paper text-lg"
                        >
                            {busy ? "儲存中…" : "儲存"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <label className="block">
            <span className="text-sm font-bold mb-1.5 block">{label}</span>
            {children}
        </label>
    );
}

// 駁回 modal — 逼使用者輸入原因，會 push 給寄賣者。
export function RejectModal({ product, onClose, onDone }) {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    async function submit(e) {
        e.preventDefault();
        if (!reason.trim()) { setError("請輸入駁回原因"); return; }
        setBusy(true);
        try {
            await api.products.reject(product.id, reason.trim());
            onDone();
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-cocoa/50 flex items-center justify-center z-50 px-4 sm:px-6" onClick={onClose}>
            <div role="dialog" aria-modal="true" className="panel shadow-press-lg w-full max-w-sm max-h-[90dvh] overflow-y-auto p-6 sm:p-7 text-ink" onClick={e => e.stopPropagation()}>
                <form onSubmit={submit}>
                    <h3 className="font-display text-[26px] pb-3 border-b-2 border-dashed border-sand">
                        駁回商品
                    </h3>
                    <div className="mt-4 text-base">
                        商品：<span className="font-bold">{product.name}</span>
                    </div>
                    <label className="block mt-4">
                        <span className="text-sm font-bold mb-1.5 block">駁回原因（會傳送給寄賣者）</span>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            autoFocus
                            rows={3}
                            placeholder="例：照片模糊、售價過高、與現有商品重複…"
                            className="field h-auto py-3 text-base resize-none"
                        />
                    </label>
                    {error && (
                        <div role="alert" className="mt-3 text-[15px] border-2 border-clay bg-peach rounded-[14px] px-3.5 py-2.5">
                            {error}
                        </div>
                    )}
                    <div className="mt-6 flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn-ghost h-12 px-5 text-base">取消</button>
                        <button type="submit" disabled={busy || !reason.trim()} className="btn-press h-12 px-6 shadow-press-sm rounded-2xl bg-clay text-paper text-lg">
                            {busy ? "駁回中…" : "確認駁回"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

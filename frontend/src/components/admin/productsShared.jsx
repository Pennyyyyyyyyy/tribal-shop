// 商品頁共用元件 —— 店內商品頁 (/admin/products) 與寄賣商品頁 (/admin/consignment-products)
// 兩邊都用到的 UI 塊；state / 資料流各自維護在 page 檔內。
import React, { useState } from "react";
import * as api from "../../service/adminApi";

export const CATEGORIES = ["零食", "玩具", "日用品", "特色商品", "調味料", "泡麵"];

export function Th({ children, className = "" }) {
    return <th className={`px-4 py-2.5 font-medium ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }) {
    return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

// 可點擊排序的 header — 顯示 ↑ / ↓ 表示當前排序欄與方向。
export function SortableTh({ sortKey, sort, onSort, align = "left", children }) {
    const active = sort.key === sortKey;
    const arrow = active ? (sort.dir === "asc" ? "↑" : "↓") : "";
    return (
        <th className={`px-4 py-2.5 font-medium ${align === "right" ? "text-right" : ""}`}>
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className={
                    "inline-flex items-center gap-1 uppercase tracking-wider transition-colors " +
                    (active ? "text-green-700" : "text-slate-500 hover:text-slate-800")
                }
            >
                {children}
                <span className="text-[10px] w-2 inline-block">{arrow}</span>
            </button>
        </th>
    );
}

export function StatusPill({ trained }) {
    return trained
        ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">已訓練</span>
        : <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">未訓練</span>;
}

// 審核徽章 —— 綠=已上架、琥珀=待審核、紅=已駁回（hover 顯示原因）。
export function ApprovalPill({ status, reason }) {
    if (status === "pending") {
        return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">待審核</span>;
    }
    if (status === "rejected") {
        return <span title={reason || "已駁回"} className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 cursor-help">已駁回</span>;
    }
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">已上架</span>;
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
                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 " +
                (active ? "bg-green-600" : "bg-slate-300")
            }
        >
            <span
                className={
                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform " +
                    (active ? "translate-x-[18px]" : "translate-x-[3px]")
                }
            />
        </button>
    );
}

export function ErrorBar({ message, onDismiss }) {
    return (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <span className="text-sm text-red-700">{message}</span>
            <button onClick={onDismiss} className="text-red-500 hover:text-red-700 text-sm">✕</button>
        </div>
    );
}

// 建立 / 編輯商品 Modal。可切換成寄賣商品（帶入 consignor_line_id）。
// consignors 為空陣列 → 寄賣切換仍可勾但下拉是空的（此頁應在切換後禁存）。
export function ProductModal({ product, consignors = [], onClose, onSaved, onDeleted }) {
    const isNew = !product;
    const [form, setForm] = useState({
        name: product?.name || "",
        price: product?.price ?? "",
        category: product?.category || CATEGORIES[0],
        stock: product?.stock ?? 0,
        is_active: product ? product.is_active !== false : true,
        consignor_line_id: product?.consignor_line_id || null,
    });
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    async function save() {
        setBusy(true);
        setError(null);
        try {
            if (isNew) await api.products.create(form);
            else await api.products.update(product.id, form);
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
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-6" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-base font-semibold text-slate-800 pb-3 border-b border-slate-200">
                    {isNew ? "新增商品" : "編輯商品"}
                </h3>

                <div className="space-y-4 mt-5">
                    <Field label="名稱">
                        <input
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            autoFocus
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm"
                        />
                    </Field>
                    <Field label="分類">
                        <select
                            value={form.category}
                            onChange={e => setForm({ ...form, category: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm"
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
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm font-semibold tabular-nums"
                            />
                        </Field>
                        <Field label="庫存">
                            <input
                                type="number"
                                value={form.stock}
                                onChange={e => setForm({ ...form, stock: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm font-semibold tabular-nums"
                            />
                        </Field>
                    </div>
                    <label className="flex items-center gap-2 mt-1 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={e => setForm({ ...form, is_active: e.target.checked })}
                            className="w-4 h-4 accent-green-600"
                        />
                        <span className="text-sm text-slate-700">上架（顧客 POS 看得到）</span>
                    </label>

                    <div className="border-t border-slate-200 pt-4 mt-2">
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
                                className="w-4 h-4 accent-amber-600"
                            />
                            <span className="text-sm text-slate-700">寄賣商品（非店家自營）</span>
                        </label>
                        {form.consignor_line_id && (
                            <div className="mt-3 pl-6">
                                <span className="text-xs font-medium text-slate-600 mb-1 block">寄賣族人</span>
                                <select
                                    value={form.consignor_line_id}
                                    onChange={e => setForm({ ...form, consignor_line_id: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm"
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
                    <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {error}
                    </div>
                )}

                <div className="mt-6 flex items-center justify-between">
                    {!isNew ? (
                        <button
                            onClick={remove}
                            disabled={busy}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                            刪除商品
                        </button>
                    ) : <span />}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium"
                        >
                            取消
                        </button>
                        <button
                            onClick={save}
                            disabled={busy || !form.name}
                            className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-slate-300 text-white text-sm font-semibold shadow-sm"
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
            <span className="text-xs font-medium text-slate-600 mb-1 block">{label}</span>
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
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-6" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <form onSubmit={submit}>
                    <h3 className="text-base font-semibold text-slate-800 pb-3 border-b border-slate-200">
                        駁回商品
                    </h3>
                    <div className="mt-4 text-sm text-slate-600">
                        商品：<span className="font-semibold text-slate-800">{product.name}</span>
                    </div>
                    <label className="block mt-4">
                        <span className="text-xs font-medium text-slate-600 mb-1 block">駁回原因（會傳送給寄賣者）</span>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            autoFocus
                            rows={3}
                            placeholder="例：照片模糊、售價過高、與現有商品重複…"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-red-500 focus:outline-none bg-white text-sm resize-none"
                        />
                    </label>
                    {error && (
                        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                            {error}
                        </div>
                    )}
                    <div className="mt-6 flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium">取消</button>
                        <button type="submit" disabled={busy || !reason.trim()} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-slate-300 text-white text-sm font-semibold shadow-sm">
                            {busy ? "駁回中…" : "確認駁回"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

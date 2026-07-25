import React, { useEffect, useState } from "react";
import * as api from "../../service/adminApi";

const CATEGORIES = ["零食", "玩具", "日用品", "特色商品", "調味料", "泡麵"];

export default function ProductsPage() {
    const [items, setItems] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);
    const [filter, setFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("全部");

    async function load() {
        setLoading(true);
        try {
            setItems(await api.products.list());
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    const filtered = items.filter(p => {
        if (categoryFilter !== "全部" && p.category !== categoryFilter) return false;
        if (!filter) return true;
        return p.name.includes(filter) || (p.category || "").includes(filter);
    });

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl font-semibold text-slate-800">商品管理</h2>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 border border-slate-200 rounded-xl bg-white px-1 py-1">
                        {["全部", ...CATEGORIES].map(c => (
                            <button
                                key={c}
                                onClick={() => setCategoryFilter(c)}
                                className={
                                    "px-3 py-1 rounded-lg text-xs transition-colors " +
                                    (categoryFilter === c
                                        ? "bg-green-600 text-white font-semibold"
                                        : "text-slate-600 hover:bg-slate-100")
                                }
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                    <input
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder="搜尋名稱"
                        className="px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm w-40"
                    />
                    <button
                        onClick={() => setCreating(true)}
                        className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold shadow-sm transition-colors"
                    >
                        新增商品
                    </button>
                </div>
            </div>

            {error && <ErrorBar message={error} onDismiss={() => setError(null)} />}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-sm text-slate-500">載入中…</div>
                ) : filtered.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                        {filter ? "找不到相符的商品" : "還沒有商品"}
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                                <Th>名稱</Th>
                                <Th>分類</Th>
                                <Th className="text-right">單價</Th>
                                <Th className="text-right">庫存</Th>
                                <Th>訓練狀態</Th>
                                <Th></Th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                    <Td className="font-medium text-slate-800">{p.name}</Td>
                                    <Td className="text-slate-600">{p.category || "—"}</Td>
                                    <Td className="text-right font-semibold tabular-nums text-slate-800">${p.price}</Td>
                                    <Td className="text-right font-semibold tabular-nums">
                                        <span className={p.stock <= 2 ? "text-red-600" : "text-slate-800"}>{p.stock}</span>
                                    </Td>
                                    <Td><StatusPill trained={p.trained} /></Td>
                                    <Td className="text-right">
                                        <button
                                            onClick={() => setEditing(p)}
                                            className="text-xs text-green-700 hover:text-green-900 font-medium"
                                        >
                                            編輯
                                        </button>
                                    </Td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {editing && (
                <ProductModal
                    product={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); load(); }}
                    onDeleted={() => { setEditing(null); load(); }}
                />
            )}
            {creating && (
                <ProductModal
                    product={null}
                    onClose={() => setCreating(false)}
                    onSaved={() => { setCreating(false); load(); }}
                />
            )}
        </div>
    );
}

function Th({ children, className = "" }) {
    return <th className={`px-4 py-2.5 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
    return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function StatusPill({ trained }) {
    return trained
        ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">已訓練</span>
        : <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">待補照片</span>;
}

function ErrorBar({ message, onDismiss }) {
    return (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <span className="text-sm text-red-700">{message}</span>
            <button onClick={onDismiss} className="text-red-500 hover:text-red-700 text-sm">✕</button>
        </div>
    );
}

function ProductModal({ product, onClose, onSaved, onDeleted }) {
    const isNew = !product;
    const [form, setForm] = useState({
        name: product?.name || "",
        price: product?.price ?? "",
        category: product?.category || CATEGORIES[0],
        stock: product?.stock ?? 0,
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

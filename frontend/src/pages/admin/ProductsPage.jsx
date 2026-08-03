import React, { useEffect, useMemo, useState } from "react";
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
    const [consignors, setConsignors] = useState([]);
    // 欄位排序：null 代表用資料庫原始順序（分類+名稱）。點欄位 header 切換 asc → desc。
    const [sort, setSort] = useState({ key: null, dir: "asc" });

    useEffect(() => {
        api.consignors.list().then(setConsignors).catch(() => { });
    }, []);
    const consignorMap = useMemo(
        () => new Map(consignors.map(c => [c.line_id, c.nickname])),
        [consignors]
    );

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

    // 樂觀切換上架——先改 UI、後打 API；失敗回滾並顯示錯誤。
    async function toggleActive(product) {
        const prev = items;
        const newVal = !product.is_active;
        setItems(items.map(p => p.id === product.id ? { ...p, is_active: newVal } : p));
        try {
            await api.products.update(product.id, { is_active: newVal });
        } catch (err) {
            setItems(prev);
            setError(err.message);
        }
    }

    const filtered = items.filter(p => {
        if (categoryFilter !== "全部" && p.category !== categoryFilter) return false;
        if (!filter) return true;
        return p.name.includes(filter) || (p.category || "").includes(filter);
    });

    // 排序後的 view：sort.key === null 走原順序，否則按型別（string / number）排。
    const sorted = useMemo(() => {
        if (!sort.key) return filtered;
        const arr = [...filtered];
        const mul = sort.dir === "asc" ? 1 : -1;
        arr.sort((a, b) => {
            const va = a[sort.key];
            const vb = b[sort.key];
            // null / undefined 一律排到最後（不論方向）
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
            return String(va).localeCompare(String(vb), "zh-Hant") * mul;
        });
        return arr;
    }, [filtered, sort]);

    function toggleSort(key) {
        setSort(s => s.key === key
            ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
            : { key, dir: "asc" });
    }

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
                ) : sorted.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                        {filter ? "找不到相符的商品" : "還沒有商品"}
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                                <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>名稱</SortableTh>
                                <SortableTh sortKey="category" sort={sort} onSort={toggleSort}>分類</SortableTh>
                                <SortableTh sortKey="price" sort={sort} onSort={toggleSort} align="right">單價</SortableTh>
                                <SortableTh sortKey="stock" sort={sort} onSort={toggleSort} align="right">庫存</SortableTh>
                                <Th>訓練狀態</Th>
                                <Th>寄賣</Th>
                                <Th>上架</Th>
                                <Th></Th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sorted.map(p => (
                                <tr key={p.id} className={"hover:bg-slate-50 transition-colors " + (p.is_active === false ? "opacity-50" : "")}>
                                    <Td className="font-medium text-slate-800">{p.name}</Td>
                                    <Td className="text-slate-600">{p.category || "—"}</Td>
                                    <Td className="text-right font-semibold tabular-nums text-slate-800">${p.price}</Td>
                                    <Td className="text-right font-semibold tabular-nums">
                                        <span className={p.stock <= 2 ? "text-red-600" : "text-slate-800"}>{p.stock}</span>
                                    </Td>
                                    <Td><StatusPill trained={p.trained} /></Td>
                                    <Td>
                                        {p.consignor_line_id ? (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                                ◎ {consignorMap.get(p.consignor_line_id) || p.consignor_line_id}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-400">—</span>
                                        )}
                                    </Td>
                                    <Td>
                                        <ActiveSwitch
                                            active={p.is_active !== false}
                                            onToggle={() => toggleActive(p)}
                                        />
                                    </Td>
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
                    consignors={consignors}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); load(); }}
                    onDeleted={() => { setEditing(null); load(); }}
                />
            )}
            {creating && (
                <ProductModal
                    product={null}
                    consignors={consignors}
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

// 可點擊排序的 header — 顯示 ↑ / ↓ 表示當前排序欄與方向。
function SortableTh({ sortKey, sort, onSort, align = "left", children }) {
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
function Td({ children, className = "" }) {
    return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function StatusPill({ trained }) {
    return trained
        ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">已訓練</span>
        : <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">未訓練</span>;
}

function ActiveSwitch({ active, onToggle }) {
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

function ErrorBar({ message, onDismiss }) {
    return (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <span className="text-sm text-red-700">{message}</span>
            <button onClick={onDismiss} className="text-red-500 hover:text-red-700 text-sm">✕</button>
        </div>
    );
}

function ProductModal({ product, consignors = [], onClose, onSaved, onDeleted }) {
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

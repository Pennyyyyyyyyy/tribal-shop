// 店內商品頁 (/admin/products) —— 只列店家自營商品（consignor_line_id 為 null）。
// 有「新增商品」按鈕，無審核 tabs / 寄賣欄 / 狀態欄（店內都 approved，這些欄多餘）。
// 寄賣商品在 /admin/consignment-products 那頁另外管理。
import React, { useEffect, useMemo, useState } from "react";
import * as api from "../../service/adminApi";
import {
    CATEGORIES,
    Th,
    Td,
    SortableTh,
    StatusPill,
    ActiveSwitch,
    ErrorBar,
    ProductModal,
} from "../../components/admin/productsShared";

export default function ProductsPage() {
    const [items, setItems] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);
    const [filter, setFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("全部");
    // 欄位排序：null 代表用資料庫原始順序（分類+名稱）。點欄位 header 切換 asc → desc。
    const [sort, setSort] = useState({ key: null, dir: "asc" });

    async function load() {
        setLoading(true);
        try {
            const all = await api.products.list();
            // 只留店內商品；寄賣商品在專屬頁面
            setItems(all.filter(p => !p.consignor_line_id));
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
                <div>
                    <h2 className="text-xl font-semibold text-slate-800">商品管理</h2>
                    <p className="text-xs text-slate-500 mt-0.5">店家自營商品</p>
                </div>
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
                        {filter || categoryFilter !== "全部" ? "找不到相符的商品" : "還沒有商品，點右上「新增商品」開始"}
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

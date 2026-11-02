// 店內商品頁 (/admin/products) —— 只列店家自營商品（consignor_line_id 為 null）。
// 有「新增商品」按鈕，無審核 tabs / 寄賣欄 / 狀態欄（店內都 approved，這些欄多餘）。
// 寄賣商品在 /admin/consignment-products 那頁另外管理。
import React, { useMemo, useState } from "react";
import { useAdminProducts } from "../../hooks/useAdminProducts";
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
    const { items, error, setError, loading, load, toggleActive } = useAdminProducts({ consignment: false });
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);
    const [filter, setFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("全部");
    // 欄位排序：null 代表用資料庫原始順序（分類+名稱）。點欄位 header 切換 asc → desc。
    const [sort, setSort] = useState({ key: null, dir: "asc" });

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
        <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4 flex-wrap">
                <div>
                    <h1 className="font-display text-[38px]">商品管理</h1>
                    <p className="text-[15px] mt-1">店家自營商品</p>
                </div>
                <button
                    onClick={() => setCreating(true)}
                    className="btn-press ml-auto h-[54px] px-6 rounded-2xl shadow-press-sm bg-clay text-paper text-xl"
                >
                    新增商品
                </button>
            </div>

            <div className="flex gap-2.5 items-center flex-wrap">
                <label htmlFor="product-search" className="sr-only">搜尋名稱</label>
                <input
                    id="product-search"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="搜尋名稱"
                    className="field h-11 w-[260px] max-w-full text-base bg-paper rounded-[14px]"
                />
                {["全部", ...CATEGORIES].map(c => (
                    <button
                        key={c}
                        onClick={() => setCategoryFilter(c)}
                        aria-pressed={categoryFilter === c}
                        className={`focus-ring pill ${categoryFilter === c ? "pill-on" : ""}`}
                    >
                        {c}
                    </button>
                ))}
            </div>

            {error && <ErrorBar message={error} onDismiss={() => setError(null)} />}

            <section className="panel overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-base opacity-70">載入中…</div>
                ) : sorted.length === 0 ? (
                    <div className="p-10 text-center text-base opacity-70">
                        {filter || categoryFilter !== "全部" ? "找不到相符的商品" : "還沒有商品，點右上「新增商品」開始"}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table min-w-[820px]">
                            <thead>
                                <tr>
                                    <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>名稱</SortableTh>
                                    <SortableTh sortKey="category" sort={sort} onSort={toggleSort}>分類</SortableTh>
                                    <SortableTh sortKey="price" sort={sort} onSort={toggleSort} align="right">單價</SortableTh>
                                    <SortableTh sortKey="stock" sort={sort} onSort={toggleSort} align="right">庫存</SortableTh>
                                    <Th>訓練狀態</Th>
                                    <Th>上架</Th>
                                    <Th></Th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map(p => (
                                    <tr key={p.id} className={"hover:bg-cream transition-colors " + (p.is_active === false ? "opacity-50" : "")}>
                                        <Td>
                                            <div className="flex items-center gap-3">
                                                {p.image_url ? (
                                                    <img src={p.image_url} alt="" className="w-11 h-11 object-cover rounded-[10px] border-2 border-sand bg-paper" />
                                                ) : (
                                                    <div className="w-11 h-11 rounded-[10px] bg-sand" aria-hidden="true" />
                                                )}
                                                <span className="font-bold">{p.name}</span>
                                            </div>
                                        </Td>
                                        <Td>{p.category || "—"}</Td>
                                        <Td className="text-right tabular-nums">NT${p.price}</Td>
                                        <Td className={`text-right tabular-nums ${p.stock <= 5 ? "text-rust font-bold" : ""}`}>{p.stock}</Td>
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
                                                className="btn-ghost h-[38px] px-4 text-[15px] rounded-xl"
                                            >
                                                編輯
                                            </button>
                                        </Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

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

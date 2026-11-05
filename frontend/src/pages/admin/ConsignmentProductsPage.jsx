// 寄賣商品頁 (/admin/consignment-products) —— 只列寄賣居民透過 LINE 上架的商品。
// 有審核 tabs（全部 / 已上架 / 待審核 / 已駁回）+ 寄賣者欄；沒有「新增商品」按鈕
// （寄賣商品僅能從 LINE 上架，店長從 admin 端不主動建）。
import React, { useEffect, useMemo, useState } from "react";
import * as api from "../../service/adminApi";
import { useAdminProducts } from "../../hooks/useAdminProducts";
import {
    CATEGORIES,
    Th,
    Td,
    SortableTh,
    StatusPill,
    ApprovalPill,
    ActiveSwitch,
    ErrorBar,
    ProductModal,
    RejectModal,
} from "../../components/admin/productsShared";

export default function ConsignmentProductsPage() {
    const { items, error, setError, loading, load, toggleActive } = useAdminProducts({ consignment: true });
    const [editing, setEditing] = useState(null);
    const [filter, setFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("全部");
    const [consignors, setConsignors] = useState([]);
    const [sort, setSort] = useState({ key: null, dir: "asc" });
    const [statusFilter, setStatusFilter] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [rejecting, setRejecting] = useState(null);

    useEffect(() => {
        api.consignors.list().then(setConsignors).catch(() => { });
    }, []);
    const consignorMap = useMemo(
        () => new Map(consignors.map(c => [c.line_id, c.nickname])),
        [consignors]
    );

    const filtered = items.filter(p => {
        if (statusFilter !== null && (p.approval_status || "approved") !== statusFilter) return false;
        if (categoryFilter !== "全部" && p.category !== categoryFilter) return false;
        if (!filter) return true;
        return p.name.includes(filter) || (p.category || "").includes(filter);
    });

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

    async function approve(p) {
        if (!confirm(`確定同意上架「${p.name}」？寄賣者會收到 LINE 通知。`)) return;
        setBusyId(p.id);
        try {
            await api.products.approve(p.id);
            await load();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    }

    const statusCounts = useMemo(() => {
        const c = { all: items.length, approved: 0, pending: 0, rejected: 0 };
        for (const p of items) {
            const s = p.approval_status || "approved";
            if (s in c) c[s]++;
        }
        return c;
    }, [items]);

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h1 className="font-display text-[38px]">寄賣商品</h1>
                <p className="text-[15px] mt-1">居民透過 LINE 上架的商品</p>
            </div>

            <div className="flex gap-2.5 items-center flex-wrap">
                <label htmlFor="consign-search" className="sr-only">搜尋名稱</label>
                <input
                    id="consign-search"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="搜尋名稱"
                    className="field h-11 w-[260px] max-w-full text-base bg-paper rounded-[14px]"
                />
                <StatusTab label="全部" count={statusCounts.all} active={statusFilter === null} onClick={() => setStatusFilter(null)} />
                <StatusTab label="待審核" count={statusCounts.pending} active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")} pulseIfNonZero />
                <StatusTab label="已上架" count={statusCounts.approved} active={statusFilter === "approved"} onClick={() => setStatusFilter("approved")} />
                <StatusTab label="已駁回" count={statusCounts.rejected} active={statusFilter === "rejected"} onClick={() => setStatusFilter("rejected")} />
            </div>
            <div className="flex gap-2 items-center flex-wrap">
                <span className="text-sm font-bold mr-1">分類</span>
                {["全部", ...CATEGORIES].map(c => (
                    <button
                        key={c}
                        onClick={() => setCategoryFilter(c)}
                        aria-pressed={categoryFilter === c}
                        className={`focus-ring pill h-9 text-sm ${categoryFilter === c ? "pill-on" : ""}`}
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
                        {filter || categoryFilter !== "全部" || statusFilter !== null
                            ? "找不到相符的商品"
                            : "還沒有寄賣商品 —— 邀請居民加 LINE bot 好友上架"}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table min-w-[960px]">
                            <thead>
                                <tr>
                                    <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>名稱</SortableTh>
                                    <Th>寄賣者</Th>
                                    <SortableTh sortKey="category" sort={sort} onSort={toggleSort}>分類</SortableTh>
                                    <SortableTh sortKey="price" sort={sort} onSort={toggleSort} align="right">單價</SortableTh>
                                    <SortableTh sortKey="stock" sort={sort} onSort={toggleSort} align="right">庫存</SortableTh>
                                    <Th>狀態</Th>
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
                                                    <div className="w-11 h-11 rounded-[10px] bg-sand flex items-center justify-center text-[11px]" aria-hidden="true">照片</div>
                                                )}
                                                <span className="font-bold">{p.name}</span>
                                            </div>
                                        </Td>
                                        <Td>{consignorMap.get(p.consignor_line_id) || p.consignor_line_id}</Td>
                                        <Td>{p.category || "—"}</Td>
                                        <Td className="text-right tabular-nums">NT${p.price}</Td>
                                        <Td className={`text-right tabular-nums ${p.stock <= 5 ? "text-rust font-bold" : ""}`}>{p.stock}</Td>
                                        <Td>
                                            <ApprovalPill status={p.approval_status || "approved"} reason={p.rejected_reason} />
                                        </Td>
                                        <Td><StatusPill trained={p.trained} /></Td>
                                        <Td>
                                            <ActiveSwitch
                                                active={p.is_active !== false}
                                                onToggle={() => toggleActive(p)}
                                            />
                                        </Td>
                                        <Td className="text-right whitespace-nowrap">
                                            {(p.approval_status === "pending") ? (
                                                <div className="inline-flex items-center gap-2">
                                                    <button
                                                        onClick={() => approve(p)}
                                                        disabled={busyId === p.id}
                                                        className="btn-press h-[38px] px-3.5 rounded-xl shadow-[0_3px_0_#4A2C1A] border-2 bg-forest text-paper text-[15px]"
                                                    >
                                                        核准上架
                                                    </button>
                                                    <button
                                                        onClick={() => setRejecting(p)}
                                                        disabled={busyId === p.id}
                                                        className="btn-ghost h-[38px] px-3.5 rounded-xl text-[15px]"
                                                    >
                                                        駁回
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setEditing(p)}
                                                    className="btn-ghost h-[38px] px-4 rounded-xl text-[15px]"
                                                >
                                                    編輯
                                                </button>
                                            )}
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
                    consignors={consignors}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); load(); }}
                    onDeleted={() => { setEditing(null); load(); }}
                />
            )}
            {rejecting && (
                <RejectModal
                    product={rejecting}
                    onClose={() => setRejecting(null)}
                    onDone={() => { setRejecting(null); load(); }}
                />
            )}
        </div>
    );
}

// 狀態篩選膠囊：全部 / 待審核 / 已上架 / 已駁回；待審核有非零時用蜜桃色提醒。
function StatusTab({ label, count, active, onClick, pulseIfNonZero }) {
    const alert = pulseIfNonZero && count > 0 && !active;
    return (
        <button
            onClick={onClick}
            aria-pressed={active}
            className={`focus-ring pill ${active ? "pill-on" : alert ? "bg-peach border-clay" : ""}`}
        >
            {label} <span className="tabular-nums opacity-75">· {count}</span>
        </button>
    );
}

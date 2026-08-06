// 寄賣商品頁 (/admin/consignment-products) —— 只列寄賣族人透過 LINE 上架的商品。
// 有審核 tabs（全部 / 已上架 / 待審核 / 已駁回）+ 寄賣者欄；沒有「新增商品」按鈕
// （寄賣商品僅能從 LINE 上架，店長從 admin 端不主動建）。
import React, { useEffect, useMemo, useState } from "react";
import * as api from "../../service/adminApi";
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
    const [items, setItems] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
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

    async function load() {
        setLoading(true);
        try {
            const all = await api.products.list();
            setItems(all.filter(p => p.consignor_line_id));
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

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
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-slate-800">寄賣商品</h2>
                    <p className="text-xs text-slate-500 mt-0.5">來自寄賣族人透過 LINE 上架的商品</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 border border-slate-200 rounded-xl bg-white px-1 py-1">
                        <StatusTab label="全部" count={statusCounts.all} active={statusFilter === null} onClick={() => setStatusFilter(null)} />
                        <StatusTab label="已上架" count={statusCounts.approved} active={statusFilter === "approved"} onClick={() => setStatusFilter("approved")} />
                        <StatusTab label="待審核" count={statusCounts.pending} active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")} pulseIfNonZero />
                        <StatusTab label="已駁回" count={statusCounts.rejected} active={statusFilter === "rejected"} onClick={() => setStatusFilter("rejected")} />
                    </div>
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
                </div>
            </div>

            {error && <ErrorBar message={error} onDismiss={() => setError(null)} />}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-sm text-slate-500">載入中…</div>
                ) : sorted.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                        {filter || categoryFilter !== "全部" || statusFilter !== null
                            ? "找不到相符的商品"
                            : "還沒有寄賣商品 —— 邀請族人加 LINE bot 好友上架"}
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                                <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>名稱</SortableTh>
                                <Th>寄賣者</Th>
                                <SortableTh sortKey="category" sort={sort} onSort={toggleSort}>分類</SortableTh>
                                <SortableTh sortKey="price" sort={sort} onSort={toggleSort} align="right">單價</SortableTh>
                                <SortableTh sortKey="stock" sort={sort} onSort={toggleSort} align="right">庫存</SortableTh>
                                <Th>訓練狀態</Th>
                                <Th>上架</Th>
                                <Th>狀態</Th>
                                <Th></Th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sorted.map(p => (
                                <tr key={p.id} className={"hover:bg-slate-50 transition-colors " + (p.is_active === false ? "opacity-50" : "")}>
                                    <Td className="font-medium text-slate-800">{p.name}</Td>
                                    <Td>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                            ◎ {consignorMap.get(p.consignor_line_id) || p.consignor_line_id}
                                        </span>
                                    </Td>
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
                                    <Td>
                                        <ApprovalPill status={p.approval_status || "approved"} reason={p.rejected_reason} />
                                    </Td>
                                    <Td className="text-right">
                                        {(p.approval_status === "pending") ? (
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    onClick={() => approve(p)}
                                                    disabled={busyId === p.id}
                                                    className="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold shadow-sm disabled:bg-slate-300"
                                                >
                                                    同意
                                                </button>
                                                <button
                                                    onClick={() => setRejecting(p)}
                                                    disabled={busyId === p.id}
                                                    className="text-xs text-red-600 hover:text-red-800 font-medium disabled:text-slate-400"
                                                >
                                                    駁回
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setEditing(p)}
                                                className="text-xs text-green-700 hover:text-green-900 font-medium"
                                            >
                                                編輯
                                            </button>
                                        )}
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

// 頂部 tab：全部 / 已上架 / 待審核 / 已駁回；待審核有非零時琥珀色強調。
function StatusTab({ label, count, active, onClick, pulseIfNonZero }) {
    const activeCls = active ? "bg-green-600 text-white font-semibold" : "text-slate-600 hover:bg-slate-100";
    const alertCls = pulseIfNonZero && count > 0 && !active ? " text-amber-700 font-semibold" : "";
    return (
        <button
            onClick={onClick}
            className={"px-3 py-1 rounded-lg text-xs transition-colors " + activeCls + alertCls}
        >
            {label} <span className="tabular-nums opacity-70">({count})</span>
        </button>
    );
}

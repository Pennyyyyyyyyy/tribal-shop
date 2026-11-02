import React, { useEffect, useMemo, useState } from "react";
import * as api from "../../../service/adminApi";
import { useAdminProducts } from "../../../hooks/useAdminProducts";
import { StatusPill, ApprovalPill, ActiveSwitch, ErrorBar, ProductModal, RejectModal } from "../../../components/admin/productsShared";
import { PageHeader, Card, PillRow, Pill, Loading, Empty, Thumb } from "../../../components/admin/mobile/mobileShared";

export default function ConsignmentMobile() {
    const { items, error, setError, loading, load, toggleActive } = useAdminProducts({ consignment: true });
    const [consignors, setConsignors] = useState([]);
    const [filter, setFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState(null);
    const [editing, setEditing] = useState(null);
    const [rejecting, setRejecting] = useState(null);
    const [busyId, setBusyId] = useState(null);

    useEffect(() => {
        api.consignors.list().then(setConsignors).catch(() => { });
    }, []);
    const consignorMap = useMemo(() => new Map(consignors.map(c => [c.line_id, c.nickname])), [consignors]);

    const counts = useMemo(() => {
        const c = { approved: 0, pending: 0, rejected: 0 };
        for (const p of items) {
            const s = p.approval_status || "approved";
            if (s in c) c[s]++;
        }
        return c;
    }, [items]);

    const filtered = items.filter(p => {
        if (statusFilter !== null && (p.approval_status || "approved") !== statusFilter) return false;
        return !filter || p.name.includes(filter) || (p.category || "").includes(filter);
    });

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

    return (
        <div className="flex flex-col gap-3.5">
            <PageHeader title="寄賣商品" subtitle="族人透過 LINE 上架的商品" />

            <label htmlFor="m-consign-search" className="sr-only">搜尋名稱</label>
            <input
                id="m-consign-search"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="搜尋名稱"
                className="field h-12 text-base bg-paper"
            />
            <PillRow>
                <Pill on={statusFilter === null} onClick={() => setStatusFilter(null)}>全部</Pill>
                <Pill on={statusFilter === "pending"} onClick={() => setStatusFilter("pending")}>待審核 · {counts.pending}</Pill>
                <Pill on={statusFilter === "approved"} onClick={() => setStatusFilter("approved")}>已上架</Pill>
                <Pill on={statusFilter === "rejected"} onClick={() => setStatusFilter("rejected")}>已駁回</Pill>
            </PillRow>

            {error && <ErrorBar message={error} onDismiss={() => setError(null)} />}

            {loading ? <Loading /> : filtered.length === 0 ? (
                <Empty>{filter || statusFilter !== null ? "找不到相符的商品" : "還沒有寄賣商品"}</Empty>
            ) : filtered.map(p => {
                const pending = p.approval_status === "pending";
                return (
                    <Card key={p.id} className={`flex flex-col gap-3 ${p.is_active === false && !pending ? "opacity-60" : ""}`}>
                        <div className="flex items-center gap-3">
                            <Thumb src={p.image_url} label="照片" />
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-[17px] truncate">{p.name}</div>
                                <div className="text-sm truncate">寄賣者 {consignorMap.get(p.consignor_line_id) || p.consignor_line_id} · {p.category || "—"}</div>
                                <div className="text-sm"><span className="tabular-nums">NT${p.price}</span> · 庫存 {p.stock}</div>
                            </div>
                            {!pending && <ActiveSwitch active={p.is_active !== false} onToggle={() => toggleActive(p)} />}
                        </div>
                        <div className="flex items-center gap-2">
                            <ApprovalPill status={p.approval_status || "approved"} reason={p.rejected_reason} />
                            <StatusPill trained={p.trained} />
                            {!pending && (
                                <button onClick={() => setEditing(p)} className="btn-ghost ml-auto h-11 px-4 rounded-xl text-[15px]">
                                    編輯
                                </button>
                            )}
                        </div>
                        {p.approval_status === "rejected" && p.rejected_reason && (
                            <div className="text-sm">駁回原因：{p.rejected_reason}</div>
                        )}
                        {pending && (
                            <div className="flex gap-2.5">
                                <button
                                    onClick={() => approve(p)}
                                    disabled={busyId === p.id}
                                    className="btn-press flex-1 h-12 rounded-xl border-2 shadow-[0_3px_0_#4A2C1A] bg-forest text-paper text-base"
                                >
                                    核准上架
                                </button>
                                <button
                                    onClick={() => setRejecting(p)}
                                    disabled={busyId === p.id}
                                    className="btn-ghost flex-1 h-12 rounded-xl text-base"
                                >
                                    駁回
                                </button>
                            </div>
                        )}
                    </Card>
                );
            })}

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

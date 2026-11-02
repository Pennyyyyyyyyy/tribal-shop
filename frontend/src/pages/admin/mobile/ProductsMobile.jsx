import React, { useState } from "react";
import { useAdminProducts } from "../../../hooks/useAdminProducts";
import { CATEGORIES, StatusPill, ActiveSwitch, ErrorBar, ProductModal } from "../../../components/admin/productsShared";
import { PageHeader, Card, PillRow, Pill, Loading, Empty, HeaderButton, Thumb } from "../../../components/admin/mobile/mobileShared";

export default function ProductsMobile() {
    const { items, error, setError, loading, load, toggleActive } = useAdminProducts({ consignment: false });
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);
    const [filter, setFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("全部");

    const filtered = items.filter(p => {
        if (categoryFilter !== "全部" && p.category !== categoryFilter) return false;
        if (!filter) return true;
        return p.name.includes(filter) || (p.category || "").includes(filter);
    });

    return (
        <div className="flex flex-col gap-3.5">
            <PageHeader
                title="商品管理"
                subtitle="店家自營商品"
                action={<HeaderButton onClick={() => setCreating(true)}>新增商品</HeaderButton>}
            />

            <label htmlFor="m-product-search" className="sr-only">搜尋名稱</label>
            <input
                id="m-product-search"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="搜尋名稱"
                className="field h-12 text-base bg-paper"
            />
            <PillRow>
                {["全部", ...CATEGORIES].map(c => (
                    <Pill key={c} on={categoryFilter === c} onClick={() => setCategoryFilter(c)}>{c}</Pill>
                ))}
            </PillRow>

            {error && <ErrorBar message={error} onDismiss={() => setError(null)} />}

            {loading ? <Loading /> : filtered.length === 0 ? (
                <Empty>{filter || categoryFilter !== "全部" ? "找不到相符的商品" : "還沒有商品，點右上「新增商品」開始"}</Empty>
            ) : filtered.map(p => (
                <Card key={p.id} className={`flex flex-col gap-2.5 ${p.is_active === false ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-3">
                        <Thumb src={p.image_url} />
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-[17px] truncate">{p.name}</div>
                            <div className="text-sm">{p.category || "—"} · <span className="tabular-nums">NT${p.price}</span></div>
                        </div>
                        <ActiveSwitch active={p.is_active !== false} onToggle={() => toggleActive(p)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`chip tabular-nums ${p.stock <= 5 ? "bg-peach" : "bg-moss"}`}>庫存 {p.stock}</span>
                        <StatusPill trained={p.trained} />
                        <button onClick={() => setEditing(p)} className="btn-ghost ml-auto h-11 px-4 rounded-xl text-[15px]">
                            編輯
                        </button>
                    </div>
                </Card>
            ))}

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

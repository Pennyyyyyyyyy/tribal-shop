import React, { useEffect, useState } from "react";
import * as api from "../../../service/adminApi";
import { RepayPanel, EditNicknameModal, CreateMemberModal } from "../../../components/admin/membersShared";
import { PageHeader, Card, Loading, Empty, HeaderButton } from "../../../components/admin/mobile/mobileShared";

export default function MembersMobile() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [repaying, setRepaying] = useState(null);
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);

    async function load() {
        setLoading(true);
        try {
            const list = await api.members.list();
            list.sort((a, b) => (b.total_debt || 0) - (a.total_debt || 0));
            setItems(list);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    return (
        <div className="flex flex-col gap-3.5">
            <PageHeader
                title="族人管理"
                subtitle="按未還款金額排序"
                action={<HeaderButton onClick={() => setCreating(true)}>新增族人</HeaderButton>}
            />

            {error && (
                <div role="alert" className="border-2 border-clay bg-peach rounded-2xl px-4 py-2.5 text-[15px]">{error}</div>
            )}

            {loading ? <Loading /> : items.length === 0 ? (
                <Empty>還沒有族人資料，點右上「新增族人」開始</Empty>
            ) : items.map(m => {
                const debt = m.total_debt || 0;
                const open = repaying?.id === m.id;
                return (
                    <Card key={m.id} strong={open} className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-[42px] h-[42px] rounded-full flex items-center justify-center font-bold text-[17px] shrink-0 ${debt > 0 ? "bg-moss" : "bg-sand"}`}
                                aria-hidden="true"
                            >
                                {(m.nickname || "?").slice(0, 1)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-[17px] truncate">{m.nickname}</div>
                                {debt > 0
                                    ? <span className="font-display text-xl text-rust tabular-nums">NT${debt.toLocaleString()}</span>
                                    : <span className="text-sm">無欠款</span>}
                            </div>
                            <button
                                onClick={() => setEditing(m)}
                                className="focus-ring h-11 px-2.5 rounded-xl text-[15px] font-bold underline"
                            >
                                編輯
                            </button>
                            {debt > 0 && !open && (
                                <button
                                    onClick={() => setRepaying(m)}
                                    className="focus-ring h-11 w-[68px] rounded-xl bg-forest text-paper text-[15px] font-bold"
                                >
                                    還款
                                </button>
                            )}
                        </div>
                        {open && (
                            <RepayPanel
                                key={m.id}
                                member={m}
                                onClose={() => setRepaying(null)}
                                onDone={() => { setRepaying(null); load(); }}
                            />
                        )}
                    </Card>
                );
            })}

            {editing && (
                <EditNicknameModal
                    member={editing}
                    onClose={() => setEditing(null)}
                    onDone={() => { setEditing(null); load(); }}
                />
            )}
            {creating && (
                <CreateMemberModal
                    onClose={() => setCreating(false)}
                    onDone={() => { setCreating(false); load(); }}
                />
            )}
        </div>
    );
}

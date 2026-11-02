import React, { useEffect, useState } from "react";
import * as api from "../../service/adminApi";
import { RepayPanel, EditNicknameModal, CreateMemberModal } from "../../components/admin/membersShared";

export default function MembersPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [repaying, setRepaying] = useState(null);
    const [editing, setEditing] = useState(null);   // 編輯暱稱
    const [creating, setCreating] = useState(false); // 新增族人

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
        <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4 flex-wrap">
                <div>
                    <h1 className="font-display text-[38px]">族人管理</h1>
                    <p className="text-[15px] mt-1">按未還款金額排序</p>
                </div>
                <button
                    onClick={() => setCreating(true)}
                    className="btn-press ml-auto h-[54px] px-6 rounded-2xl shadow-press-sm bg-clay text-paper text-xl"
                >
                    新增族人
                </button>
            </div>

            {error && (
                <div role="alert" className="border-2 border-clay bg-peach rounded-2xl px-4 py-2.5 text-[15px]">
                    {error}
                </div>
            )}

            <div className="flex gap-6 flex-wrap items-start">
                <section className="panel flex-[999_1_560px] min-w-0 overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center text-base opacity-70">載入中…</div>
                    ) : items.length === 0 ? (
                        <div className="p-10 text-center text-base opacity-70">
                            還沒有族人資料，點右上「新增族人」開始
                        </div>
                    ) : (
                        <>
                            <div className="flex px-5 py-3 bg-wheat text-sm font-bold">
                                <span className="flex-1 pl-[60px]">暱稱</span>
                                <span className="w-[140px] text-right">目前欠款</span>
                                <span className="w-[168px]"></span>
                            </div>
                            <ul>
                                {items.map(m => {
                                    const debt = m.total_debt || 0;
                                    const selected = repaying?.id === m.id;
                                    return (
                                        <li
                                            key={m.id}
                                            className={`flex items-center gap-4 px-5 py-3.5 border-t-2 border-wheat ${selected ? "bg-cream" : ""}`}
                                        >
                                            <div
                                                className={`w-11 h-11 rounded-full flex items-center justify-center font-display text-xl shrink-0 ${debt > 0 ? "bg-moss" : "bg-sand"}`}
                                                aria-hidden="true"
                                            >
                                                {(m.nickname || "?").slice(0, 1)}
                                            </div>
                                            <span className="flex-1 font-bold text-[17px]">{m.nickname}</span>
                                            <span className={`w-[140px] text-right tabular-nums ${debt > 0 ? "font-display text-[22px] text-rust" : "text-base"}`}>
                                                {debt > 0 ? `NT$${debt.toLocaleString()}` : "無欠款"}
                                            </span>
                                            <span className="w-[168px] flex justify-end gap-2">
                                                <button
                                                    onClick={() => setEditing(m)}
                                                    className="focus-ring h-10 px-3 rounded-xl text-[15px] font-bold underline"
                                                >
                                                    編輯
                                                </button>
                                                {debt > 0 && (
                                                    <button
                                                        onClick={() => setRepaying(m)}
                                                        aria-pressed={selected}
                                                        className={selected
                                                            ? "focus-ring h-10 px-4 rounded-xl text-[15px] font-bold bg-clay text-paper border-2 border-ink"
                                                            : "btn-ghost h-10 px-4 rounded-xl text-[15px]"}
                                                    >
                                                        還款
                                                    </button>
                                                )}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                </section>

                <aside className="panel flex-[1_1_340px] p-6 shadow-press">
                    {repaying ? (
                        <RepayPanel
                            key={repaying.id}
                            member={repaying}
                            onClose={() => setRepaying(null)}
                            onDone={() => { setRepaying(null); load(); }}
                        />
                    ) : (
                        <div className="flex flex-col gap-2">
                            <h2 className="font-display text-[26px]">記錄還款</h2>
                            <p className="text-base">在左邊列表按族人的「還款」，就能在這裡輸入金額。</p>
                        </div>
                    )}
                </aside>
            </div>

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

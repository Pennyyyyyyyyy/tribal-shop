import React, { useEffect, useState } from "react";
import * as api from "../../service/adminApi";
import { ComposeForm, EditModal } from "../../components/admin/announcementsShared";

export default function AnnouncementsPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(null);

    async function load() {
        setLoading(true);
        try {
            setItems(await api.announcements.list());
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function remove(a) {
        if (!confirm(`確定刪除公告「${a.title || "店長廣播"}」？`)) return;
        try {
            await api.announcements.remove(a.id);
            await load();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h1 className="font-display text-[38px]">公告管理</h1>
                <p className="text-[15px] mt-1">發布後現場平板跑馬燈立即同步</p>
            </div>

            {error && (
                <div role="alert" className="border-2 border-clay bg-peach rounded-2xl px-4 py-2.5 text-[15px]">
                    {error}
                </div>
            )}

            <div className="flex gap-6 flex-wrap items-start">
                <ComposeForm onCreated={load} />

                <section className="panel flex-[1_1_420px] min-w-0 p-6 flex flex-col gap-3">
                    <h2 className="font-display text-[26px] mb-1">歷史公告</h2>
                    {loading ? (
                        <div className="py-10 text-center text-base opacity-70">載入中…</div>
                    ) : items.length === 0 ? (
                        <div className="py-10 text-center text-base opacity-70">還沒有公告</div>
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {items.map((a, i) => (
                                <li key={a.id || i} className="bg-cream rounded-2xl px-4 py-3.5 flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-3 flex-wrap">
                                            <span className="font-bold">{a.title || "店長廣播"}</span>
                                            <span className="text-sm tabular-nums opacity-75">
                                                {a.upload_time ? new Date(a.upload_time).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : ""}
                                            </span>
                                        </div>
                                        <div className="text-base mt-1 whitespace-pre-wrap">{a.description}</div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button
                                            onClick={() => setEditing(a)}
                                            className="focus-ring rounded px-2 py-1 text-sm font-bold underline"
                                        >
                                            編輯
                                        </button>
                                        <button
                                            onClick={() => remove(a)}
                                            className="focus-ring rounded px-2 py-1 text-sm font-bold text-clay underline"
                                        >
                                            刪除
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            {editing && (
                <EditModal
                    announcement={editing}
                    onClose={() => setEditing(null)}
                    onDone={() => { setEditing(null); load(); }}
                />
            )}
        </div>
    );
}

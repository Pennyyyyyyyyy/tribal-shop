import React, { useEffect, useState } from "react";
import * as api from "../../../service/adminApi";
import { ComposeForm, EditModal } from "../../../components/admin/announcementsShared";
import { PageHeader, Card, Loading, Empty } from "../../../components/admin/mobile/mobileShared";

export default function AnnouncementsMobile() {
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
        <div className="flex flex-col gap-3.5">
            <PageHeader title="公告管理" subtitle="發布後現場平板跑馬燈立即同步" />

            {error && (
                <div role="alert" className="border-2 border-clay bg-peach rounded-2xl px-4 py-2.5 text-[15px]">{error}</div>
            )}

            <ComposeForm onCreated={load} className="px-3.5 py-4" />

            <h2 className="font-display text-[22px] mt-1">歷史公告</h2>
            {loading ? <Loading /> : items.length === 0 ? (
                <Empty>還沒有公告</Empty>
            ) : items.map((a, i) => (
                <Card key={a.id || i} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline gap-2">
                        <span className="flex-1 min-w-0 truncate font-bold">{a.title || "店長廣播"}</span>
                        <span className="text-[13px] tabular-nums shrink-0">
                            {a.upload_time ? new Date(a.upload_time).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : ""}
                        </span>
                    </div>
                    <div className="text-[15px] whitespace-pre-wrap">{a.description}</div>
                    <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(a)} className="focus-ring h-11 px-3 rounded-lg text-sm font-bold underline">
                            編輯
                        </button>
                        <button onClick={() => remove(a)} className="focus-ring h-11 px-3 rounded-lg text-sm font-bold text-clay underline">
                            刪除
                        </button>
                    </div>
                </Card>
            ))}

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

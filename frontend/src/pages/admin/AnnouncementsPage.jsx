import React, { useEffect, useState } from "react";
import * as api from "../../service/adminApi";

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
        <div className="space-y-5">
            <div>
                <h2 className="text-xl font-semibold text-slate-800">公告管理</h2>
                <p className="text-xs text-slate-500 mt-0.5">發布後現場平板跑馬燈立即同步</p>
            </div>

            <ComposeForm onCreated={load} />

            {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {error}
                </div>
            )}

            <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">歷史公告</h3>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center text-sm text-slate-500">載入中…</div>
                    ) : items.length === 0 ? (
                        <div className="p-10 text-center text-sm text-slate-500">還沒有公告</div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {items.map((a, i) => (
                                <li key={a.id || i} className="px-4 py-3 flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] text-slate-500 tabular-nums mb-0.5">
                                            {a.upload_time ? new Date(a.upload_time).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : ""}
                                        </div>
                                        <div className="text-sm font-semibold text-slate-800">
                                            {a.title || "店長廣播"}
                                        </div>
                                        <div className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{a.description}</div>
                                    </div>
                                    <div className="flex gap-3 shrink-0 pt-1">
                                        <button
                                            onClick={() => setEditing(a)}
                                            className="text-xs text-slate-500 hover:text-green-700 font-medium"
                                        >
                                            編輯
                                        </button>
                                        <button
                                            onClick={() => remove(a)}
                                            className="text-xs text-slate-500 hover:text-red-600 font-medium"
                                        >
                                            刪除
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>

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

function ComposeForm({ onCreated }) {
    const [title, setTitle] = useState("店長廣播");
    const [description, setDescription] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    async function submit(e) {
        e.preventDefault();
        if (!description.trim()) return;
        setBusy(true);
        setError(null);
        try {
            await api.announcements.create({ title, description: description.trim() });
            setDescription("");
            setTitle("店長廣播");
            onCreated();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">撰寫新公告</h3>

            <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">標題</span>
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm"
                />
            </label>

            <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">內容</span>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    placeholder="例：本週末小米酒新到貨，歡迎試飲"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm resize-none"
                />
            </label>

            {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {error}
                </div>
            )}

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={busy || !description.trim()}
                    className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-slate-300 text-white text-sm font-semibold shadow-sm"
                >
                    {busy ? "發布中…" : "發布公告"}
                </button>
            </div>
        </form>
    );
}

function EditModal({ announcement, onClose, onDone }) {
    const [title, setTitle] = useState(announcement.title || "店長廣播");
    const [description, setDescription] = useState(announcement.description || "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    async function submit(e) {
        e.preventDefault();
        if (!description.trim()) { setError("內容不能空白"); return; }
        setBusy(true);
        setError(null);
        try {
            await api.announcements.update(announcement.id, {
                title,
                description: description.trim(),
            });
            onDone();
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-6" onClick={onClose}>
            <form
                onSubmit={submit}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-base font-semibold text-slate-800 pb-3 border-b border-slate-200">
                    編輯公告
                </h3>

                <div className="space-y-4 mt-5">
                    <label className="block">
                        <span className="text-xs font-medium text-slate-600 mb-1 block">標題</span>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-medium text-slate-600 mb-1 block">內容</span>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={5}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm resize-none"
                        />
                    </label>
                </div>

                {error && (
                    <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {error}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium"
                    >
                        取消
                    </button>
                    <button
                        type="submit"
                        disabled={busy || !description.trim()}
                        className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-slate-300 text-white text-sm font-semibold shadow-sm"
                    >
                        {busy ? "儲存中…" : "儲存"}
                    </button>
                </div>
            </form>
        </div>
    );
}

// 公告頁共用：撰寫表單（含跑馬燈預覽）、編輯彈窗（電腦版與手機版都用）
import React, { useState } from "react";
import * as api from "../../service/adminApi";

export function ComposeForm({ onCreated, className = "flex-[1_1_440px] p-6" }) {
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
        <form onSubmit={submit} className={`panel shadow-press min-w-0 flex flex-col gap-3.5 ${className}`}>
            <h2 className="font-display text-[26px]">撰寫新公告</h2>

            <label htmlFor="ann-title" className="font-bold text-[15px]">標題</label>
            <input
                id="ann-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="店長廣播"
                className="field h-12 text-base"
            />

            <label htmlFor="ann-body" className="font-bold text-[15px]">內容</label>
            <textarea
                id="ann-body"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="例：本週末小米酒新到貨，歡迎試飲"
                className="field h-auto py-3 text-base resize-none"
            />

            {/* 平板跑馬燈預覽：POS 頂欄只顯示標題 */}
            <div className="text-sm font-bold mt-1">平板上的樣子</div>
            <div className="bg-forest rounded-2xl px-4 py-3">
                <div className="h-11 rounded-full bg-paper/15 flex items-center gap-3 px-5 text-paper text-base font-medium overflow-hidden whitespace-nowrap">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                        <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
                        <path d="M15 9a4 4 0 0 1 0 6" />
                    </svg>
                    <span className={`truncate ${title.trim() ? "" : "opacity-60"}`}>
                        {title.trim() || "輸入標題後在這裡預覽"}
                    </span>
                </div>
            </div>

            {error && (
                <div role="alert" className="border-2 border-clay bg-peach rounded-[14px] px-3.5 py-2.5 text-[15px]">
                    {error}
                </div>
            )}

            <div className="flex items-center gap-3 flex-wrap mt-1">
                <span className="text-sm mr-auto">發布後，現場平板的跑馬燈會立即更新。</span>
                <button
                    type="submit"
                    disabled={busy || !description.trim()}
                    className="btn-press h-14 px-7 rounded-2xl shadow-press-sm bg-clay text-paper text-xl"
                >
                    {busy ? "發布中…" : "發布公告"}
                </button>
            </div>
        </form>
    );
}

export function EditModal({ announcement, onClose, onDone }) {
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
        <div className="fixed inset-0 bg-cocoa/50 flex items-center justify-center z-50 px-4 sm:px-6" onClick={onClose}>
            <form
                onSubmit={submit}
                role="dialog"
                aria-modal="true"
                className="panel shadow-press-lg w-full max-w-md max-h-[90dvh] overflow-y-auto p-6 sm:p-7 text-ink"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="font-display text-[26px] pb-3 border-b-2 border-dashed border-sand">
                    編輯公告
                </h3>

                <div className="space-y-4 mt-5">
                    <label className="block">
                        <span className="text-[15px] font-bold mb-1.5 block">標題</span>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="field h-12 text-base"
                        />
                    </label>

                    <label className="block">
                        <span className="text-[15px] font-bold mb-1.5 block">內容</span>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={5}
                            className="field h-auto py-3 text-base resize-none"
                        />
                    </label>
                </div>

                {error && (
                    <div role="alert" className="mt-3 text-[15px] border-2 border-clay bg-peach rounded-[14px] px-3.5 py-2.5">
                        {error}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-ghost h-12 px-5 text-base"
                    >
                        取消
                    </button>
                    <button
                        type="submit"
                        disabled={busy || !description.trim()}
                        className="btn-press h-12 px-6 rounded-2xl shadow-press-sm bg-forest text-paper text-lg"
                    >
                        {busy ? "儲存中…" : "儲存"}
                    </button>
                </div>
            </form>
        </div>
    );
}

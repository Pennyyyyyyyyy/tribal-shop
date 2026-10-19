import React, { useEffect } from "react";
import { useAnnouncement } from "../context/AnnouncementContext";

const AUTO_CLOSE_MS = 15000;

export default function AnnouncementPopup() {
  const { announcement, popupOpen, closePopup } = useAnnouncement();

  useEffect(() => {
    if (!popupOpen) return;
    const timer = setTimeout(() => closePopup(), AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [popupOpen, closePopup]);

  if (!popupOpen || !announcement) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={closePopup}
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-3xl bg-white shadow-2xl p-8 animate-[fadeIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-green-700 text-white text-sm font-bold px-4 py-1.5">
          <span>📢</span>
          <span>最新消息</span>
        </div>

        <button
          type="button"
          aria-label="關閉"
          onClick={closePopup}
          className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition"
        >
          <span className="text-2xl leading-none">×</span>
        </button>

        <h3 className="mt-5 text-2xl font-black text-slate-900 leading-snug">
          {announcement.title}
        </h3>

        <p className="mt-3 text-slate-600 leading-relaxed whitespace-pre-wrap">
          {announcement.description}
        </p>

        <div className="mt-8 flex justify-end">
          <a
            href={announcement.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-green-700 text-white font-semibold px-5 py-2.5 hover:bg-green-800 transition"
          >
            查看詳情 <span>→</span>
          </a>
        </div>

        <p className="mt-4 text-xs text-slate-400 text-right">
          15 秒後將自動關閉
        </p>
      </div>
    </div>
  );
}

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-cocoa/60 backdrop-blur-sm"
      onClick={closePopup}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
        className="panel relative w-full max-w-lg mx-4 rounded-[28px] shadow-press-lg p-8 text-ink animate-[fadeIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-forest text-paper text-sm font-bold px-4 py-1.5">
          最新消息
        </div>

        <button
          type="button"
          aria-label="關閉"
          onClick={closePopup}
          className="focus-ring absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full text-ink/60 hover:bg-sand hover:text-ink transition"
        >
          <span className="text-2xl leading-none">×</span>
        </button>

        <h3 id="announcement-title" className="mt-5 font-display text-[28px] leading-snug">
          {announcement.title}
        </h3>

        <p className="mt-3 text-lg leading-relaxed whitespace-pre-wrap opacity-85">
          {announcement.description}
        </p>

        <div className="mt-8 flex justify-end">
          <a
            href={announcement.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press h-14 px-6 bg-clay text-paper text-xl gap-2"
          >
            查看詳情 <span aria-hidden="true">→</span>
          </a>
        </div>

        <p className="mt-4 text-sm opacity-60 text-right">15 秒後將自動關閉</p>
      </div>
    </div>
  );
}

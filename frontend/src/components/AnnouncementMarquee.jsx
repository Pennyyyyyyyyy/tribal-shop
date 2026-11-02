import React from "react";
import { useAnnouncement } from "../context/AnnouncementContext";

function SpeakerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M15 9a4 4 0 0 1 0 6" />
      <path d="M18 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

export default function AnnouncementMarquee() {
  const { announcement, dismissed, openPopup } = useAnnouncement();

  // 公告彈窗關掉之前不顯示跑馬燈，留白撐住頂欄排版
  if (!dismissed || !announcement) return <div className="flex-1" />;

  return (
    <button
      type="button"
      onClick={openPopup}
      className="focus-ring flex-1 min-w-0 h-12 rounded-full bg-paper/15 hover:bg-paper/25 transition flex items-center gap-3 pl-[22px] overflow-hidden"
      aria-label="查看最新消息"
    >
      <SpeakerIcon />
      <div className="relative flex-1 overflow-hidden h-full">
        <div className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap animate-marquee">
          <span className="text-[17px] font-medium pr-12">{announcement.title}</span>
          <span className="text-[17px] font-medium pr-12">{announcement.title}</span>
        </div>
      </div>
    </button>
  );
}

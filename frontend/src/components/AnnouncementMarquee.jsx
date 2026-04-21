import React from "react";
import { useAnnouncement } from "../context/AnnouncementContext";

export default function AnnouncementMarquee() {
  const { announcement, dismissed, openPopup } = useAnnouncement();

  if (!dismissed || !announcement) return null;

  return (
    <button
      type="button"
      onClick={openPopup}
      className="flex-1 mx-4 min-w-0 h-10 rounded-full bg-green-800/70 hover:bg-green-800 transition flex items-center overflow-hidden"
      aria-label="查看最新消息"
    >
      <span className="pl-5 pr-3 text-lg shrink-0">📢</span>
      <div className="relative flex-1 overflow-hidden h-full">
        <div className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap animate-marquee">
          <span className="text-white text-sm font-semibold pr-12">
            {announcement.title}
          </span>
          <span className="text-white text-sm font-semibold pr-12">
            {announcement.title}
          </span>
        </div>
      </div>
    </button>
  );
}

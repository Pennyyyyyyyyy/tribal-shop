import React, { createContext, useContext, useState } from "react";

// TODO: 之後改為從後端 /api/announcement 抓取 announcement 表資料
const MOCK_ANNOUNCEMENT = {
  id: 1,
  title: "部落豐年祭特別活動開跑！",
  description:
    "即日起至月底，族人消費滿 200 元即可參加抽獎，獎品豐富包含手工編織品、農產禮盒。歡迎大家一同參與部落盛事。",
  url: "https://www.tribal-shop.example/news/harvest-festival",
};

const AnnouncementContext = createContext(null);

export function useAnnouncement() {
  const ctx = useContext(AnnouncementContext);
  if (!ctx)
    throw new Error("useAnnouncement must be used within AnnouncementProvider");
  return ctx;
}

export function AnnouncementProvider({ children }) {
  const [announcement] = useState(MOCK_ANNOUNCEMENT);
  const [popupOpen, setPopupOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const openPopup = () => setPopupOpen(true);
  const closePopup = () => {
    setPopupOpen(false);
    setDismissed(true);
  };

  return (
    <AnnouncementContext.Provider
      value={{
        announcement,
        popupOpen,
        dismissed,
        openPopup,
        closePopup,
      }}
    >
      {children}
    </AnnouncementContext.Provider>
  );
}

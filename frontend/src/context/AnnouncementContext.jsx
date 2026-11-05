import React, { createContext, useContext, useState } from "react";

// TODO: 之後改為從後端 /api/announcement 抓取 announcement 表資料
const MOCK_ANNOUNCEMENT = {
  id: 1,
  title: "徵求泰雅族服飾工作室（坊）及工藝師",
  description:
    "116 年度「桃園市復興區泰雅族服飾購製補助示範計畫」，公開徵求自薦或推薦本區製作泰雅族服飾的工作室（坊）及工藝師。\n\n" +
    "受理期間：即日起至 115 年 12 月 10 日（四）",
  url: "https://www.fuxing.tycg.gov.tw/News_Content.aspx?n=5708&s=1954256",
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

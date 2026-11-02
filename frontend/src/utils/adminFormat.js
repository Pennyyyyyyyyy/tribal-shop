// 後台共用的小工具（電腦版與手機版都用）。放在 .js 檔，避免和元件混在一起影響 Fast Refresh。

export const PENDING_DEBTOR = "待確認族人";

// 台灣時區 YYYY-MM-DD（daysOffset 可傳負值代表往前推）
export function taipeiDate(daysOffset = 0) {
    const d = new Date(Date.now() + daysOffset * 24 * 3600 * 1000);
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(d);
    const y = parts.find(p => p.type === "year").value;
    const m = parts.find(p => p.type === "month").value;
    const dd = parts.find(p => p.type === "day").value;
    return `${y}-${m}-${dd}`;
}

export function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
    });
}

// 只取 HH:mm（手機版交易卡片用）
export function formatTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("zh-TW", {
        timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false,
    });
}

export function safeParseItems(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return []; }
}

// 台灣時區 helper — Supabase 存 UTC，但業務上一律用「台灣今天/當日」思考。
// Cloudflare Worker 本身時區是 UTC；用 Intl 明確指定 Asia/Taipei 才會對。

const TZ = "Asia/Taipei";

// 台灣現在的日期 YYYY-MM-DD（不含時間）。
export function taipeiToday() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find(p => p.type === "year").value;
    const m = parts.find(p => p.type === "month").value;
    const d = parts.find(p => p.type === "day").value;
    return `${y}-${m}-${d}`;
}

// 把「YYYY-MM-DD」變成該日在台灣時區的 00:00:00（給 Supabase gte 比對 UTC timestamptz 欄位）。
export function taipeiDayStart(dateStr) {
    return `${dateStr}T00:00:00+08:00`;
}

// 把「YYYY-MM-DD」變成該日在台灣時區的 23:59:59.999（給 Supabase lte 比對）。
export function taipeiDayEnd(dateStr) {
    return `${dateStr}T23:59:59.999+08:00`;
}

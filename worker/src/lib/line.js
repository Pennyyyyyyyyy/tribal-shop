// LINE Messaging API 低階 wrapper。只包 HTTP + auth header，不含業務邏輯。
//
// 雙 channel（架構 X）：每個 call 要指定 channel: 'manager' | 'consignor'。
// 用 body.destination 分派 → channel → 選對 access token → 呼叫 LINE API。
// 這樣兩支 bot 天然隔離，token 錯了 LINE 直接擋。

const REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const PUSH_URL = "https://api.line.me/v2/bot/message/push";
const CONTENT_URL = (messageId) => `https://api-data.line.me/v2/bot/message/${messageId}/content`;

function tokenFor(env, channel) {
    return channel === "consignor"
        ? env.LINE_CONSIGNOR_CHANNEL_ACCESS_TOKEN
        : env.LINE_CHANNEL_ACCESS_TOKEN;
}

function authHeaders(env, channel) {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenFor(env, channel)}`,
    };
}

// Reply API：對某個 replyToken 回一組 messages（陣列）。10 分鐘內、一次性 token。
// replyToken 是 channel-scoped，channel 傳錯會被 LINE 擋。
export async function reply(env, channel, replyToken, messages) {
    return fetch(REPLY_URL, {
        method: "POST",
        headers: authHeaders(env, channel),
        body: JSON.stringify({ replyToken, messages }),
    });
}

// 便利 wrapper：回一段純文字。
export async function replyText(env, channel, replyToken, text) {
    return reply(env, channel, replyToken, [{ type: "text", text }]);
}

// Push API：主動推訊息給某 userId（如：結帳通知）。
// userId 也是 channel-scoped —— 用錯 channel 的 token push 該 channel 的 userId，LINE 會擋。
export async function push(env, channel, to, messages) {
    return fetch(PUSH_URL, {
        method: "POST",
        headers: authHeaders(env, channel),
        body: JSON.stringify({ to, messages }),
    });
}

// 抓 LINE 使用者傳來的圖片/檔案（訓練照片流程用）。回傳 Blob。
export async function fetchContent(env, channel, messageId) {
    const r = await fetch(CONTENT_URL(messageId), {
        headers: { "Authorization": `Bearer ${tokenFor(env, channel)}` },
    });
    return r.blob();
}

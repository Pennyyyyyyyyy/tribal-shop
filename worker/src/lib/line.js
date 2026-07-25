// LINE Messaging API 低階 wrapper。只包 HTTP + auth header，不含業務邏輯。

const REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const PUSH_URL = "https://api.line.me/v2/bot/message/push";
const CONTENT_URL = (messageId) => `https://api-data.line.me/v2/bot/message/${messageId}/content`;

function authHeaders(env) {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    };
}

// Reply API：對某個 replyToken 回一組 messages（陣列）。10 分鐘內、一次性 token。
export async function reply(env, replyToken, messages) {
    return fetch(REPLY_URL, {
        method: "POST",
        headers: authHeaders(env),
        body: JSON.stringify({ replyToken, messages }),
    });
}

// 便利 wrapper：回一段純文字。
export async function replyText(env, replyToken, text) {
    return reply(env, replyToken, [{ type: "text", text }]);
}

// Push API：主動推訊息給某 userId（如：結帳通知）。
export async function push(env, to, messages) {
    return fetch(PUSH_URL, {
        method: "POST",
        headers: authHeaders(env),
        body: JSON.stringify({ to, messages }),
    });
}

// 抓 LINE 使用者傳來的圖片/檔案（訓練照片流程用）。回傳 Blob。
export async function fetchContent(env, messageId) {
    const r = await fetch(CONTENT_URL(messageId), {
        headers: { "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    return r.blob();
}

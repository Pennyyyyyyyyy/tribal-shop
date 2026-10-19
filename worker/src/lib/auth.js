// JWT (HS256) 簽 / 驗，用 Cloudflare Workers 內建的 Web Crypto API。
// 不引入額外套件（jsonwebtoken 等）以維持 Worker bundle 小 + 冷啟動快。

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ── base64url ────────────────────────────────────────────────────
function bytesToBase64Url(bytes) {
    const arr = new Uint8Array(bytes);
    let bin = "";
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlToBytes(str) {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

// ── HMAC key from secret ─────────────────────────────────────────
async function hmacKey(secret) {
    return crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
    );
}

// ── JWT sign / verify ────────────────────────────────────────────
export async function signJwt(payload, secret, ttlSeconds = 60 * 60 * 24) {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const full = { ...payload, iat: now, exp: now + ttlSeconds };
    const headerB64 = bytesToBase64Url(encoder.encode(JSON.stringify(header)));
    const payloadB64 = bytesToBase64Url(encoder.encode(JSON.stringify(full)));
    const signing = `${headerB64}.${payloadB64}`;
    const key = await hmacKey(secret);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signing));
    return `${signing}.${bytesToBase64Url(sig)}`;
}

// 通過 → 回 payload；任何錯誤（格式錯 / 簽章壞 / 過期）→ 回 null。
export async function verifyJwt(token, secret) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const [headerB64, payloadB64, sigB64] = parts;
        const key = await hmacKey(secret);
        const ok = await crypto.subtle.verify(
            "HMAC",
            key,
            base64UrlToBytes(sigB64),
            encoder.encode(`${headerB64}.${payloadB64}`),
        );
        if (!ok) return null;
        const payload = JSON.parse(decoder.decode(base64UrlToBytes(payloadB64)));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch (_err) {
        return null;
    }
}

// 常數時間字串比較，避免 timing side-channel 攻擊猜密碼。
export function timingSafeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return mismatch === 0;
}

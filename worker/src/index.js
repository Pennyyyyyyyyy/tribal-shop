// 飛鼠商店 Worker 入口 — 只做 CORS + route dispatch + cron trigger。
// 所有實際邏輯在 handlers/ + services/ + lib/。
import { handleCheckout } from "./handlers/checkout.js";
import { handleLineWebhook } from "./handlers/lineWebhook.js";
import { handleAdminApi } from "./handlers/adminApi.js";
import * as products from "./services/products.js";
import * as notifications from "./services/notifications.js";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: CORS_HEADERS });
        }

        // Admin API：/api/admin/* → JWT-protected 後台介面
        if (url.pathname.startsWith("/api/admin")) {
            return handleAdminApi(request, env, url);
        }

        // POS 公開商品列表（只回上架商品）。取代 FastAPI legacy /api/products。
        if (request.method === "GET" && url.pathname === "/api/products") {
            return jsonResponse(await products.listForPos(env));
        }

        // POS 結帳
        if (request.method === "POST" && url.pathname === "/checkout") {
            return handleCheckout(request, env);
        }

        // LINE webhook 有時會設成根路徑，保留 "/" 也接。
        // 傳 ctx 讓 webhook 能用 waitUntil 處理照片下載等長時間 async work。
        if (request.method === "POST" && (url.pathname === "/callback" || url.pathname === "/")) {
            return handleLineWebhook(request, env, ctx);
        }

        return new Response("OK");
    },

    // Cron trigger — 台北 23:00（wrangler.toml 設 "0 15 * * *" UTC）跑寄賣者當日銷售彙總。
    async scheduled(_event, env, ctx) {
        ctx.waitUntil(notifications.dailyConsignorDigest(env));
    },
};

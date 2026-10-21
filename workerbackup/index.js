// workerbackup/index.js - Cloudflare Worker 進入點 (分流店長、寄賣者、POS 結帳與後台管理 API)

import {
  CORS_HEADERS,
  jsonResponse,
  listForPos,
  getByLineId,
  autoRegister
} from "./common.js";
import {
  handleManagerEvent,
  notifyManagerEmbeddingComplete
} from "./manager.js";
import {
  handleConsignorEvent,
  dailyConsignorDigest
} from "./consignor.js";
import {
  handleAdminApi,
  handleCheckout
} from "./admin.js";

// ============================================================
// 1. LINE Webhook 總分流入口
// ============================================================
async function handleLineWebhook(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    console.error("[webhook] JSON 解析失敗:", err?.message);
    return new Response("OK");
  }

  if (!body.events || body.events.length === 0) return new Response("OK");

  ctx.waitUntil(
    processEvent(env, body).catch((err) => {
      console.error("[webhook] processEvent 未捕捉例外:", err?.stack || err?.message || err);
    })
  );

  return new Response("OK");
}

async function processEvent(env, body) {
  const destination = body.destination;
  // 依據 Bot ID 判斷來源頻道
  const channel = destination === env.LINE_CONSIGNOR_BOT_ID
    ? "consignor"
    : destination === env.LINE_MANAGER_BOT_ID
    ? "manager"
    : null;

  console.log(`[webhook] destination=${destination} channel=${channel} events=${body.events.length}`);

  if (!channel) {
    console.warn(`[webhook] 未知 destination（非 manager 也非 consignor bot），忽略。`);
    return;
  }

  const event = body.events[0];
  const userId = event.source?.userId;
  if (!userId) return;

  const defaultRole = channel === "consignor" ? "consignor" : "manager";
  const existingUser = await getByLineId(env, userId);
  const user = existingUser || await autoRegister(env, userId, defaultRole);

  console.log(`[webhook] userId=${userId} role=${user.role} last_command=${user.last_command} event.type=${event.type}`);

  // ⭐️ 核心分流：店長交給 manager.js，寄賣者交給 consignor.js
  if (channel === "manager") {
    return await handleManagerEvent(env, event, user, userId);
  } else if (channel === "consignor") {
    return await handleConsignorEvent(env, event, user, userId);
  }
}

// ============================================================
// 2. Cloudflare Worker 主服務進入點 (Fetch & Scheduled)
// ============================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 處理 CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // 1. 後台管理 API
    if (url.pathname.startsWith("/api/admin")) {
      return handleAdminApi(request, env, url);
    }

    // 2. 前端 POS 商品列表 (僅回傳已核准上架商品)
    if (request.method === "GET" && url.pathname === "/api/products") {
      return jsonResponse(await listForPos(env));
    }

    // 3. 前端 POS 結帳
    if (request.method === "POST" && url.pathname === "/checkout") {
      return handleCheckout(request, env);
    }

    // 4. ⭐️ 樹莓派 AI 學習完成回報 Callback (專屬推播給店長)
    if (request.method === "POST" && url.pathname === "/api/internal/embedding-complete") {
      try {
        const body = await request.json();
        await notifyManagerEmbeddingComplete(env, {
          productId: body.product_id,
          success: body.status === "completed",
          error: body.error
        });
        return jsonResponse({ success: true });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // 5. LINE Bot Webhook
    if (request.method === "POST" && (url.pathname === "/callback" || url.pathname === "/")) {
      return handleLineWebhook(request, env, ctx);
    }

    return new Response("OK");
  },

  // 定時排程 (Cron Trigger)：每天台北時間 23:00 推播寄賣者當日銷售摘要
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(dailyConsignorDigest(env));
  }
};

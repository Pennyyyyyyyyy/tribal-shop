// workerbackup/consignor.js - 寄賣者專屬模組 (寄賣者選單、商品上架送審、銷售查詢、分潤紀錄、每日對帳推播)

import {
  query,
  post,
  postReturn,
  patch,
  remove,
  reply,
  replyText,
  push,
  replyConsignorOnly,
  setState,
  resetState,
  updateNickname,
  isConsignor,
  getProductById,
  createPendingProduct,
  setImageUrl,
  getOrCreateForProduct,
  nextEmptyImageField,
  attachImage,
  listManagers,
  PRODUCT_CATEGORIES,
  APPROVAL_LABEL,
  taipeiToday,
  taipeiDayStart,
  taipeiDayEnd,
  trimDate
} from "./common.js";
import { notifyManagerReview } from "./manager.js";

// ============================================================
// 1. 寄賣者通知與選單介面
// ============================================================

export async function notifyWelcome(env, lineId) {
  const text = `哈囉～歡迎來到飛鼠商店 🌲\n\n在這裡你可以寄賣自己的商品：無論是餅乾、農產品、手作飾品，都能透過我們的自助商店賣給來訪的客人。\n\n店家會幫你收銀、代為結帳，每月月底跟你結算分潤 💰\n\n為了讓我能記住你，我可以怎麼稱呼你呢？（可以輸入名字或暱稱）`;
  return push(env, "consignor", lineId, [{ type: "text", text }]);
}

export async function sendConsignorMenu(env, replyToken, greeting) {
  return reply(env, "consignor", replyToken, [{
    type: "text",
    text: greeting || "需要協助什麼嗎？",
    quickReply: {
      items: [
        { type: "action", action: { type: "postback", label: "📤 上架商品", data: "action=consignor_upload_start", displayText: "上架商品" } },
        { type: "action", action: { type: "postback", label: "📋 我的商品", data: "action=consignor_list_own", displayText: "查看我的商品" } },
        { type: "action", action: { type: "postback", label: "📊 銷售情況", data: "action=consignor_view_sales", displayText: "查看銷售" } },
        { type: "action", action: { type: "postback", label: "💰 分潤紀錄", data: "action=consignor_view_payouts", displayText: "查看分潤" } },
        { type: "action", action: { type: "message", label: "改暱稱", text: "/改暱稱" } }
      ]
    }
  }]);
}

export async function notifyConsignorApproval(env, consignorLineId, productName) {
  return push(env, "consignor", consignorLineId, [{
    type: "text",
    text: `✅ 您的商品「${productName}」已通過審核，正式上架！\n祝賣個好價錢 🎉`
  }]);
}

export async function notifyConsignorRejection(env, consignorLineId, productName, reason) {
  const text = `❌ 您的商品「${productName}」未通過審核。\n\n原因：${reason || "（店長未說明）"}\n\n修正後可重新上傳。`;
  return push(env, "consignor", consignorLineId, [{ type: "text", text }]);
}

export async function notifyConsignorPayout(env, { lineId, nickname, gross_amount, net_payout, period_start, period_end, items }) {
  const itemLines = (items || []).map((it) => `${it.product_name || "#" + it.product_id} × ${it.quantity} = $${it.subtotal}`).join("\n");
  const text = `您好 ${nickname}，\n您在飛鼠商店 ${period_start} ~ ${period_end} 期間的\n總銷售額：$ ${gross_amount}\n實拿金額：$ ${net_payout}\n\n銷售商品明細：\n${itemLines}`;
  return push(env, "consignor", lineId, [{ type: "text", text }]);
}

// ============================================================
// 2. 寄賣者查詢服務 (Sales & Payouts)
// ============================================================

export async function getSalesInRange(env, lineId, from, to) {
  const startISO = encodeURIComponent(taipeiDayStart(from));
  const endISO = encodeURIComponent(taipeiDayEnd(to));
  const txs = await query(
    env,
    `/rest/v1/transaction?created_at=gte.${startISO}&created_at=lte.${endISO}&select=id,created_at,identity,type&order=created_at.desc`
  );
  const txArr = Array.isArray(txs) ? txs : [];
  if (txArr.length === 0) return [];
  const txIds = txArr.map((t) => t.id).join(",");
  const items = await query(
    env,
    `/rest/v1/transaction_items?consignor_line_id=eq.${encodeURIComponent(lineId)}&transaction_id=in.(${txIds})&select=id,transaction_id,product_id,quantity,unit_price`
  );
  const itemsArr = Array.isArray(items) ? items : [];
  if (itemsArr.length === 0) return [];
  const productIds = [...new Set(itemsArr.map((i) => i.product_id).filter((id) => id != null))];
  const nameMap = new Map();
  if (productIds.length > 0) {
    const products = await query(
      env,
      `/rest/v1/products?id=in.(${productIds.join(",")})&select=id,name`
    );
    for (const p of Array.isArray(products) ? products : []) {
      nameMap.set(p.id, p.name);
    }
  }
  const itemsByTx = new Map();
  for (const it of itemsArr) {
    if (!itemsByTx.has(it.transaction_id)) itemsByTx.set(it.transaction_id, []);
    itemsByTx.get(it.transaction_id).push(it);
  }
  const out = [];
  for (const tx of txArr) {
    const its = itemsByTx.get(tx.id) || [];
    for (const it of its) {
      out.push({
        transaction_id: it.transaction_id,
        product_id: it.product_id,
        product_name: nameMap.get(it.product_id) || `(已刪除商品 #${it.product_id})`,
        quantity: it.quantity,
        unit_price: it.unit_price,
        subtotal: (it.quantity || 0) * (it.unit_price || 0),
        transaction_created_at: tx.created_at,
        transaction_identity: tx.identity
      });
    }
  }
  return out;
}

export async function listPayouts(env, { lineId, status } = {}) {
  let path = "/rest/v1/payouts?select=*&order=period_start.desc";
  if (lineId) path += `&consignor_line_id=eq.${encodeURIComponent(lineId)}`;
  if (status) path += `&status=eq.${encodeURIComponent(status)}`;
  return query(env, path);
}

// 每日 23:00 推播今日銷售摘要給寄賣者 (Cron)
export async function dailyConsignorDigest(env) {
  try {
    const consignors = await query(env, "/rest/v1/users?role=eq.consignor&select=line_id,nickname");
    if (!Array.isArray(consignors) || consignors.length === 0) return;
    const today = taipeiToday();
    const startISO = encodeURIComponent(taipeiDayStart(today));
    const endISO = encodeURIComponent(taipeiDayEnd(today));
    const txs = await query(
      env,
      `/rest/v1/transaction?created_at=gte.${startISO}&created_at=lte.${endISO}&select=id`
    );
    if (!Array.isArray(txs) || txs.length === 0) return;
    const txIds = txs.map((t) => t.id).join(",");
    const items = await query(
      env,
      `/rest/v1/transaction_items?consignor_line_id=not.is.null&transaction_id=in.(${txIds})&select=consignor_line_id,product_id,quantity,unit_price`
    );
    if (!Array.isArray(items) || items.length === 0) return;
    const productIds = [...new Set(items.map((i) => i.product_id).filter((id) => id != null))];
    const nameMap = new Map();
    if (productIds.length > 0) {
      const products = await query(env, `/rest/v1/products?id=in.(${productIds.join(",")})&select=id,name`);
      for (const p of Array.isArray(products) ? products : []) nameMap.set(p.id, p.name);
    }
    const byConsignor = new Map();
    for (const it of items) {
      const key = it.consignor_line_id;
      if (!byConsignor.has(key)) byConsignor.set(key, new Map());
      const perProd = byConsignor.get(key);
      const prev = perProd.get(it.product_id) || { quantity: 0, subtotal: 0 };
      prev.quantity += it.quantity;
      prev.subtotal += it.quantity * it.unit_price;
      perProd.set(it.product_id, prev);
    }
    const nickByLine = new Map(consignors.map((c) => [c.line_id, c.nickname]));
    const pushes = [];
    for (const [lineId, perProd] of byConsignor) {
      const nickname = nickByLine.get(lineId);
      const lines = [];
      let total = 0;
      for (const [pid, agg] of perProd) {
        const name = nameMap.get(pid) || `(已刪除商品 #${pid})`;
        lines.push(`${name} × ${agg.quantity} = $${agg.subtotal}`);
        total += agg.subtotal;
      }
      const header = nickname ? `📊 ${nickname}，今日銷售摘要（${today}）` : `📊 今日銷售摘要（${today}）`;
      const text = `${header}\n\n${lines.join("\n")}\n\n今日總銷售：$${total}`;
      pushes.push(push(env, "consignor", lineId, [{ type: "text", text }]));
    }
    await Promise.allSettled(pushes);
  } catch (err) {
    console.error("[daily-digest] failed:", err);
  }
}

// ============================================================
// 3. 寄賣者事件處理核心 (Router)
// ============================================================

export async function handleConsignorEvent(env, event, user, userId) {
  const channel = "consignor";

  // 1. 關注事件 (Follow)
  if (event.type === "follow") {
    await setState(env, userId, "WAITING_NICKNAME");
    await notifyWelcome(env, userId);
    return new Response("OK");
  }

  // 2. Postback 事件
  if (event.type === "postback") {
    return handleConsignorPostback(env, event, user, userId, channel);
  }

  // 3. 文字訊息事件 (Text)
  if (event.type === "message" && event.message.type === "text") {
    return handleConsignorText(env, event, user, userId, user.last_command, channel);
  }

  // 4. 圖片訊息事件 (Image)
  if (event.type === "message" && event.message.type === "image") {
    return handleConsignorImage(env, event, user, userId, channel);
  }

  return new Response("OK");
}

// ============================================================
// 4. 寄賣者 Postback 處理
// ============================================================
async function handleConsignorPostback(env, event, user, userId, channel) {
  if (!isConsignor(user)) return await replyConsignorOnly(env, channel, event);

  const data = event.postback.data;
  const params = new URLSearchParams(data);
  const action = params.get("action");

  // 寄賣者開始上架商品
  if (action === "consignor_upload_start") {
    await setState(env, userId, "WAITING_CONSIGNOR_PRODUCT_INFO");
    return await replyText(
      env,
      channel,
      event.replyToken,
      "📝 請輸入商品資訊（用空格分隔）：\n[名稱] [價格] [分類] [初始庫存]\n\n分類：零食、玩具、日用品、特色商品、調味料、泡麵\n例：手工餅乾 50 零食 20"
    );
  }

  // 寄賣者查詢銷售情況
  if (action === "consignor_view_sales") {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const monthStart = today.slice(0, 7) + "-01";
    const sales = await getSalesInRange(env, userId, monthStart, today);
    if (sales.length === 0) {
      return await replyText(env, channel, event.replyToken, `📊 你的本月銷售 (${monthStart}~${today})\n\n本月尚無銷售。`);
    }
    const byProduct = new Map();
    for (const s of sales) {
      const key = s.product_id;
      const prev = byProduct.get(key) || { name: s.product_name, qty: 0, subtotal: 0 };
      prev.qty += s.quantity;
      prev.subtotal += s.subtotal;
      byProduct.set(key, prev);
    }
    const rows = [...byProduct.values()].sort((a, b) => b.subtotal - a.subtotal);
    const total = rows.reduce((s, x) => s + x.subtotal, 0);
    const lines = rows.map((x) => `${x.name} × ${x.qty} = $${x.subtotal.toLocaleString()}`);
    const text = `📊 你的本月銷售 (${monthStart.slice(5)}~${today.slice(5)})\n\n總銷售：$${total.toLocaleString()}\n\n${lines.join("\n")}`;
    return await replyText(env, channel, event.replyToken, text);
  }

  // 寄賣者查看分潤紀錄
  if (action === "consignor_view_payouts") {
    const list = await listPayouts(env, { lineId: userId });
    const recent = (Array.isArray(list) ? list : []).slice(0, 6);
    if (recent.length === 0) {
      return await replyText(env, channel, event.replyToken, "💰 你的分潤紀錄\n\n目前尚無結算紀錄（店長月底會統一結算）。");
    }
    const lines = recent.map((pt) => {
      const emoji = pt.status === "paid" ? "✅" : "⏳";
      const range = `${trimDate(pt.period_start)}~${trimDate(pt.period_end)}`;
      const statusText = pt.status === "paid" ? `已付 ${trimDate((pt.paid_at || "").slice(0, 10))}` : "待付款";
      return `${emoji} ${range} · 應收 $${(pt.net_payout || 0).toLocaleString()} · ${statusText}`;
    });
    return await replyText(env, channel, event.replyToken, `💰 你的分潤紀錄\n\n${lines.join("\n")}`);
  }

  // 寄賣者查看自己上架的商品
  if (action === "consignor_list_own") {
    const rows = await query(
      env,
      `/rest/v1/products?consignor_line_id=eq.${encodeURIComponent(userId)}&select=id,name,stock,approval_status,rejected_reason&order=id.desc`
    );
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) {
      return await replyText(env, channel, event.replyToken, "你還沒上架任何商品。");
    }
    const lines = list.map((p, i) => {
      const label = APPROVAL_LABEL[p.approval_status] || p.approval_status;
      let extra = "";
      if (p.approval_status === "rejected" && p.rejected_reason) {
        extra = `\n   ↳ 駁回原因：${p.rejected_reason}`;
      }
      return `${i + 1}. ${p.name}（庫存: ${p.stock}）[${label}]${extra}`;
    });
    return await replyText(env, channel, event.replyToken, `📋 你的商品清單：\n\n${lines.join("\n")}`);
  }

  return new Response("OK");
}

// ============================================================
// 5. 寄賣者文字訊息處理
// ============================================================
async function handleConsignorText(env, event, user, userId, currentState, channel) {
  const userMsg = (event.message.text || "").trim();
  const p = userMsg.split(/\s+/);

  // 1. 設定/更新暱稱
  if (currentState === "WAITING_NICKNAME" || userMsg === "/改暱稱" || userMsg === "改暱稱") {
    if (userMsg === "/改暱稱" || userMsg === "改暱稱") {
      await setState(env, userId, "WAITING_NICKNAME");
      return await replyText(env, channel, event.replyToken, "好的，請輸入新暱稱：");
    }
    await updateNickname(env, userId, userMsg);
    await resetState(env, userId);
    return await sendConsignorMenu(env, event.replyToken, `太好了，${userMsg}！以下是你可以在飛鼠商店做的事：`);
  }

  // 2. 寄賣商品資訊輸入 [名稱] [價格] [分類] [初始庫存]
  if (currentState === "WAITING_CONSIGNOR_PRODUCT_INFO") {
    if (!isConsignor(user)) return await replyConsignorOnly(env, channel, event);
    if (p.length < 4 || !PRODUCT_CATEGORIES.includes(p[2])) {
      return await replyText(
        env,
        channel,
        event.replyToken,
        "❌ 格式錯誤。請輸入：[名稱] [價格] [分類] [初始庫存]\n分類：零食、玩具、日用品、特色商品、調味料、泡麵\n例：手工餅乾 50 零食 20"
      );
    }
    let product;
    try {
      product = await createPendingProduct(env, {
        name: p[0],
        price: p[1],
        category: p[2],
        stock: p[3],
        consignorLineId: userId
      });
    } catch (err) {
      console.error("[consignor-upload] error:", err);
      return await replyText(env, channel, event.replyToken, `❌ 建立商品失敗：${err?.message || "unknown"}`);
    }
    await setState(env, userId, "WAITING_PRODUCT_PHOTOS", { productId: product.id, photoCount: 0 });
    return await replyText(env, channel, event.replyToken, `✅ 商品「${p[0]}」建立成功！\n\n請先上傳商品的「正面照」1 張 📸`);
  }

  // 預設回傳寄賣者主選單
  return sendConsignorMenu(env, event.replyToken);
}

// ============================================================
// 6. 寄賣者圖片訊息處理 (商品拍照上傳 & 送店長審核)
// ============================================================
async function handleConsignorImage(env, event, user, userId, channel) {
  if (user.last_command !== "WAITING_PRODUCT_PHOTOS") {
    return new Response("OK");
  }
  const { productId, photoCount = 0 } = user.temp_data || {};
  if (!productId) return new Response("OK");

  let trainData;
  try {
    trainData = await getOrCreateForProduct(env, productId);
  } catch (err) {
    return await replyText(env, channel, event.replyToken, `❌ 讀取訓練資料失敗：${err?.message || "unknown"}`);
  }

  const field = nextEmptyImageField(trainData);
  if (!field) {
    console.warn("[consignor-image] 6 個照片槽位已滿");
    return new Response("OK");
  }

  let url;
  try {
    url = await attachImage(env, channel, {
      messageId: event.message.id,
      productId,
      trainDataId: trainData.id,
      field
    });
  } catch (err) {
    return await replyText(env, channel, event.replyToken, `❌ 存照片失敗：${err?.message || "unknown"}`);
  }

  const product = await getProductById(env, productId);
  if (product && (!product.image_url || field === "image1")) {
    await setImageUrl(env, productId, url);
  }

  const productName = product?.name || "";
  let replyMsg;
  if (field === "image1") {
    replyMsg = `✅ 已收到「${productName}」的正面照\n\n接下來請上傳側面照 5 張 📸`;
  } else if (field === "image2") {
    replyMsg = `📸 已收到側面照（1/5）`;
  } else if (field === "image3") {
    replyMsg = `📸 已收到側面照（2/5）`;
  } else if (field === "image4") {
    replyMsg = `📸 已收到側面照（3/5）`;
  } else if (field === "image5") {
    replyMsg = `📸 已收到側面照（4/5）`;
  } else {
    replyMsg = `✅ 已收齊 6 張照片！「${productName}」已送出審核，等店長確認 🌲`;
  }

  const isFinal = field === "image6";
  if (isFinal) {
    // ⭐️ 先回覆寄賣者
    try {
      await replyText(env, channel, event.replyToken, replyMsg);
    } catch (err) {
      console.error("[consignor-image] replyText failed:", err);
    }

    // ⭐️ 推播待審核通知給店長群
    try {
      await resetState(env, userId);
      const managers = await listManagers(env);
      for (const m of managers) {
        try {
          await notifyManagerReview(env, {
            managerLineId: m.line_id,
            product,
            coverPhotoUrl: url,
            consignorNickname: user.nickname
          });
        } catch (pushErr) {
          console.error(`[consignor-image] push to manager ${m.line_id} failed:`, pushErr);
        }
      }
    } catch (bgErr) {
      console.error("[consignor-image] background review notify error:", bgErr);
    }
    return new Response("OK");
  }

  await setState(env, userId, "WAITING_PRODUCT_PHOTOS", { productId, photoCount: photoCount + 1 });
  return await replyText(env, channel, event.replyToken, replyMsg);
}

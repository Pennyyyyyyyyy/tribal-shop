// workerbackup/common.js - 共用核心模組 (Supabase、LINE API、資料存取與共用輔助函式)

// ============================================================
// 1. Supabase REST API 輔助函式
// ============================================================
export function authHeaders(env) {
  return {
    "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
  };
}

export async function query(env, path) {
  const r = await fetch(`${env.SUPABASE_URL}${path}`, { headers: authHeaders(env) });
  return r.json();
}

export async function post(env, path, body) {
  return fetch(`${env.SUPABASE_URL}${path}`, {
    method: "POST",
    headers: { ...authHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function postReturn(env, path, body) {
  const r = await fetch(`${env.SUPABASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(env),
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok || !Array.isArray(data)) {
    console.error(`[supabase] postReturn ${path} 失敗 status=${r.status}:`, JSON.stringify(data));
    throw new Error(`Supabase postReturn 失敗 (${r.status}): ${data?.message || data?.hint || "unknown"}`);
  }
  return data[0];
}

export async function patch(env, path, body) {
  return fetch(`${env.SUPABASE_URL}${path}`, {
    method: "PATCH",
    headers: { ...authHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function remove(env, path) {
  return fetch(`${env.SUPABASE_URL}${path}`, {
    method: "DELETE",
    headers: authHeaders(env)
  });
}

export async function uploadPublic(env, bucket, path, blob, contentType = "image/jpeg", upsert = false) {
  const headers = { ...authHeaders(env), "Content-Type": contentType };
  if (upsert) headers["x-upsert"] = "true";
  await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers,
    body: blob
  });
  return `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// ============================================================
// 2. 台北時間輔助函式
// ============================================================
export const TZ = "Asia/Taipei";

export function taipeiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

export function taipeiDayStart(dateStr) {
  return `${dateStr}T00:00:00+08:00`;
}

export function taipeiDayEnd(dateStr) {
  return `${dateStr}T23:59:59.999+08:00`;
}

export function trimDate(iso) {
  if (!iso) return "?";
  const [_y, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

// ============================================================
// 3. 常數定義
// ============================================================
export const PRODUCT_CATEGORIES = ["零食", "玩具", "日用品", "特色商品", "調味料", "泡麵"];

export const APPROVAL_LABEL = {
  pending: "待審核",
  approved: "已上架",
  rejected: "已駁回"
};

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

// ============================================================
// 4. LINE Messaging API
// ============================================================
export const REPLY_URL = "https://api.line.me/v2/bot/message/reply";
export const PUSH_URL = "https://api.line.me/v2/bot/message/push";
export const CONTENT_URL = (messageId) => `https://api-data.line.me/v2/bot/message/${messageId}/content`;

export function tokenFor(env, channel) {
  return channel === "consignor" ? env.LINE_CONSIGNOR_CHANNEL_ACCESS_TOKEN : env.LINE_CHANNEL_ACCESS_TOKEN;
}

export function authHeaders2(env, channel) {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${tokenFor(env, channel)}`
  };
}

export async function reply(env, channel, replyToken, messages) {
  return fetch(REPLY_URL, {
    method: "POST",
    headers: authHeaders2(env, channel),
    body: JSON.stringify({ replyToken, messages })
  });
}

export async function replyText(env, channel, replyToken, text) {
  return reply(env, channel, replyToken, [{ type: "text", text }]);
}

export async function push(env, channel, to, messages) {
  return fetch(PUSH_URL, {
    method: "POST",
    headers: authHeaders2(env, channel),
    body: JSON.stringify({ to, messages })
  });
}

export async function fetchContent(env, channel, messageId) {
  const r = await fetch(CONTENT_URL(messageId), {
    headers: { "Authorization": `Bearer ${tokenFor(env, channel)}` }
  });
  return r.blob();
}

export async function replyManagerOnly(env, channel, event) {
  return replyText(env, channel, event.replyToken, "⛔ 此功能僅限店長操作。");
}

export async function replyConsignorOnly(env, channel, event) {
  return replyText(env, channel, event.replyToken, "⛔ 此功能僅限寄賣者操作。");
}

export function kv(label, value) {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: label, color: "#888888", size: "sm", flex: 2 },
      { type: "text", text: String(value), size: "sm", flex: 5, wrap: true }
    ]
  };
}

// ============================================================
// 5. 使用者服務 (Users)
// ============================================================
export async function getByLineId(env, lineId) {
  const r = await query(env, `/rest/v1/users?line_id=eq.${lineId}&select=*`);
  return r[0] || null;
}

export async function autoRegister(env, lineId, role = "consignor") {
  const newUser = { line_id: lineId, nickname: "新夥伴", role };
  await post(env, "/rest/v1/users", newUser);
  return newUser;
}

export async function listManagers(env) {
  return query(env, "/rest/v1/users?role=eq.manager&select=line_id");
}

export async function setState(env, lineId, lastCommand, tempData) {
  const body = { last_command: lastCommand };
  if (tempData !== void 0) body.temp_data = tempData;
  return patch(env, `/rest/v1/users?line_id=eq.${lineId}`, body);
}

export async function resetState(env, lineId) {
  return patch(env, `/rest/v1/users?line_id=eq.${lineId}`, { last_command: null });
}

export async function updateNickname(env, lineId, nickname) {
  return patch(env, `/rest/v1/users?line_id=eq.${encodeURIComponent(lineId)}`, { nickname });
}

export function isManager(user) {
  return (user?.role || "").toLowerCase() === "manager";
}

export function isConsignor(user) {
  return (user?.role || "").toLowerCase() === "consignor";
}

// ============================================================
// 6. 商品服務 (Products)
// ============================================================
export async function listProducts(env) {
  return query(env, "/rest/v1/products?select=id,name,stock,image_url,category&order=category,name");
}

export async function listForPos(env) {
  const r = await query(
    env,
    "/rest/v1/products?is_active=eq.true&approval_status=eq.approved&select=id,name,price,category,image_url&order=category,name"
  );
  return Array.isArray(r) ? r : [];
}

export async function listAllProducts(env) {
  return query(env, "/rest/v1/products?select=*&order=category,name");
}

export async function getConsignorMap(env, ids) {
  if (!ids || !ids.length) return new Map();
  const rows = await query(env, `/rest/v1/products?id=in.(${ids.join(",")})&select=id,consignor_line_id`);
  return new Map((Array.isArray(rows) ? rows : []).map((p) => [p.id, p.consignor_line_id]));
}

export async function getProductById(env, id) {
  const r = await query(env, `/rest/v1/products?id=eq.${id}`);
  return r[0] || null;
}

export async function assignProductLabel(env, productId) {
  const label = `product_${productId}`;
  for (const [path, body] of [
    [`/rest/v1/products?id=eq.${productId}`, { label_name: label }],
    [`/rest/v1/training_data?product_id=eq.${productId}`, { english_name: label }]
  ]) {
    const response = await patch(env, path, body);
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`更新商品標籤失敗 (${response.status}): ${detail}`);
    }
  }
}

export async function createProduct(env, { name, price, category, stock }) {
  const product = await postReturn(env, "/rest/v1/products", {
    name,
    price: parseInt(price),
    category,
    stock: parseInt(stock),
    trained: false,
    is_active: true,
    approval_status: "approved"
  });
  const trainingResponse = await post(env, "/rest/v1/training_data", {
    product_id: product.id,
    english_name: `product_${product.id}`
  });
  if (!trainingResponse.ok) {
    throw new Error(`建立商品訓練資料失敗 (${trainingResponse.status}): ${await trainingResponse.text()}`);
  }
  await assignProductLabel(env, product.id);
  return product;
}

export async function createPendingProduct(env, { name, price, category, stock, consignorLineId }) {
  const product = await postReturn(env, "/rest/v1/products", {
    name,
    price: parseInt(price),
    category,
    stock: parseInt(stock),
    trained: false,
    is_active: false,
    approval_status: "pending",
    consignor_line_id: consignorLineId
  });
  const trainingResponse = await post(env, "/rest/v1/training_data", {
    product_id: product.id,
    english_name: `product_${product.id}`
  });
  if (!trainingResponse.ok) {
    throw new Error(`建立商品訓練資料失敗 (${trainingResponse.status}): ${await trainingResponse.text()}`);
  }
  await assignProductLabel(env, product.id);
  return product;
}

export async function approveProduct(env, id) {
  await patch(env, `/rest/v1/products?id=eq.${id}`, {
    approval_status: "approved",
    is_active: true,
    rejected_reason: null
  });
  return getProductById(env, id);
}

export async function rejectProduct(env, id, reason) {
  await patch(env, `/rest/v1/products?id=eq.${id}`, {
    approval_status: "rejected",
    is_active: false,
    rejected_reason: reason || ""
  });
  return getProductById(env, id);
}

export async function listPendingProducts(env) {
  return query(env, "/rest/v1/products?approval_status=eq.pending&select=*&order=id.desc");
}

export async function adjustStock(env, id, delta) {
  const rows = await query(env, `/rest/v1/products?id=eq.${id}&select=stock`);
  if (!rows.length) return null;
  const newStock = (rows[0].stock || 0) + delta;
  await patch(env, `/rest/v1/products?id=eq.${id}`, { stock: newStock });
  return newStock;
}

export async function recordRestock(env, productId, quantity) {
  return post(env, "/rest/v1/stock", {
    product_id: productId,
    quantity,
    restock_date: taipeiToday()
  });
}

export async function setImageUrl(env, id, url) {
  return patch(env, `/rest/v1/products?id=eq.${id}`, { image_url: url });
}

export const UPDATABLE_FIELDS = ["name", "price", "category", "stock", "image_url", "trained", "is_active", "consignor_line_id"];
export const INT_FIELDS = new Set(["price", "stock"]);
export const BOOL_FIELDS = new Set(["trained", "is_active"]);

export async function updateProduct(env, id, patch2) {
  const clean = {};
  for (const key of UPDATABLE_FIELDS) {
    if (patch2[key] === void 0) continue;
    if (INT_FIELDS.has(key)) clean[key] = parseInt(patch2[key]);
    else if (BOOL_FIELDS.has(key)) clean[key] = Boolean(patch2[key]);
    else clean[key] = patch2[key];
  }
  if (Object.keys(clean).length === 0) return getProductById(env, id);
  await patch(env, `/rest/v1/products?id=eq.${id}`, clean);
  return getProductById(env, id);
}

export async function removeProduct(env, id) {
  return remove(env, `/rest/v1/products?id=eq.${id}`);
}

export async function findLowStock(env, threshold = 5) {
  return query(env, `/rest/v1/products?stock=lte.${threshold}&select=id,name,stock&order=stock`);
}

// ⭐️ 修復重點：加入 ?on_conflict=product_id，防止與 Trigger 重複排程撞 409
export async function enqueueEmbeddingJob(env, productId) {
  const id = Number(productId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid product ID");
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/embedding_jobs?on_conflict=product_id`, {
    method: "POST",
    headers: {
      ...authHeaders(env),
      "Content-Type": "application/json",
      "Prefer": "resolution=ignore-duplicates,return=minimal"
    },
    body: JSON.stringify({ product_id: id, status: "pending" })
  });
  if (!response.ok && response.status !== 409) {
    const detail = await response.text().catch(() => "");
    console.warn(`[embedding_job] 排程通知 (${response.status}): ${detail}`);
  }
}

// ============================================================
// 7. 訓練資料 (Training Data)
// ============================================================
export async function getOrCreateForProduct(env, productId) {
  const existing = (await query(env, `/rest/v1/training_data?product_id=eq.${productId}`))[0];
  if (existing) return existing;
  return postReturn(env, "/rest/v1/training_data", {
    product_id: productId,
    english_name: `product_${productId}`
  });
}

export function nextEmptyImageField(trainData) {
  if (!trainData.image1) return "image1";
  if (!trainData.image2) return "image2";
  if (!trainData.image3) return "image3";
  if (!trainData.image4) return "image4";
  if (!trainData.image5) return "image5";
  if (!trainData.image6) return "image6";
  return null;
}

export async function attachImage(env, channel, { messageId, productId, trainDataId, field }) {
  const blob = await fetchContent(env, channel, messageId);
  const path = `${productId}/${field}.jpg`;
  const url = await uploadPublic(env, "products", path, blob, "image/jpeg", true);
  await patch(env, `/rest/v1/training_data?id=eq.${trainDataId}`, { [field]: url });
  return url;
}

// ============================================================
// 8. 族人賒帳 (Members)
// ============================================================
export async function listMembers(env) {
  return query(env, "/rest/v1/member?select=id,nickname,total_debt&order=nickname");
}

export async function listAllNicknames(env) {
  return query(env, "/rest/v1/member?select=nickname");
}

export async function getMemberById(env, id) {
  const r = await query(env, `/rest/v1/member?id=eq.${id}`);
  return r[0] || null;
}

export async function getMemberByNickname(env, nickname) {
  const r = await query(env, `/rest/v1/member?nickname=eq.${nickname}&select=*`);
  return r[0] || null;
}

export async function addDebtForTransaction(env, { memberId, txId, amount }) {
  const member = await getMemberById(env, memberId);
  if (!member) return null;
  await post(env, "/rest/v1/credit", {
    member_id: memberId,
    transaction_id: txId,
    transaction_total: amount
  });
  await patch(env, `/rest/v1/member?id=eq.${memberId}`, {
    total_debt: (member.total_debt || 0) + amount
  });
  return member;
}

export async function repayDebt(env, id, amount) {
  const member = await getMemberById(env, id);
  if (!member) return null;
  const newTotalDebt = Math.max(0, (member.total_debt || 0) - amount);
  await patch(env, `/rest/v1/member?id=eq.${id}`, { total_debt: newTotalDebt });
  return newTotalDebt;
}

export async function totalOutstandingDebt(env) {
  const all = await query(env, "/rest/v1/member?select=total_debt");
  return all.reduce((s, m) => s + (m.total_debt || 0), 0);
}

// ============================================================
// 9. 交易服務 (Transactions)
// ============================================================
export async function uploadEvidence(env, blob) {
  const path = `evidence_${Date.now()}.jpg`;
  return uploadPublic(env, "evidence", path, blob, "image/jpeg");
}

export async function createTransaction(env, { type, total, cart, photoBlob }) {
  const photoUrl = await uploadEvidence(env, photoBlob);
  const tx = await postReturn(env, "/rest/v1/transaction", {
    type,
    total: parseInt(total),
    item_list: JSON.stringify(cart),
    checkout_image: photoUrl,
    identity: type === "credit" ? "待確認族人" : "遊客"
  });
  if (Array.isArray(cart) && cart.length > 0) {
    const productIds = [...new Set(cart.map((it) => it.id).filter((id) => id != null))];
    const consignorMap = await getConsignorMap(env, productIds);
    const rows = cart.map((it) => ({
      transaction_id: tx.id,
      product_id: it.id ?? null,
      quantity: it.quantity || 1,
      unit_price: it.price ?? 0,
      consignor_line_id: consignorMap.get(it.id) || null
    }));
    await post(env, "/rest/v1/transaction_items", rows);
  }
  return { tx, photoUrl };
}

export async function getTransactionById(env, id) {
  const r = await query(env, `/rest/v1/transaction?id=eq.${id}`);
  return r[0] || null;
}

export async function listTransactions(env, { from, to } = {}) {
  let path = "/rest/v1/transaction?select=*&order=created_at.desc";
  if (from) path += `&created_at=gte.${encodeURIComponent(taipeiDayStart(from))}`;
  if (to) path += `&created_at=lte.${encodeURIComponent(taipeiDayEnd(to))}`;
  return query(env, path);
}

export async function listTransactionsSince(env, isoDate) {
  return query(env, `/rest/v1/transaction?created_at=gte.${encodeURIComponent(isoDate)}&select=total`);
}

export async function setTransactionIdentity(env, id, identity) {
  return patch(env, `/rest/v1/transaction?id=eq.${id}`, { identity });
}

// ============================================================
// 10. 公告服務 (Announcements)
// ============================================================
export async function createAnnouncement(env, { title = "店長廣播", description }) {
  return post(env, "/rest/v1/announcement", {
    title,
    description,
    upload_time: new Date().toISOString()
  });
}

export async function listAnnouncements(env) {
  return query(env, "/rest/v1/announcement?select=*&order=upload_time.desc");
}

export async function updateAnnouncement(env, id, { title, description }) {
  const body = {};
  if (title !== void 0) body.title = title;
  if (description !== void 0) body.description = description;
  return patch(env, `/rest/v1/announcement?id=eq.${id}`, body);
}

export async function removeAnnouncement(env, id) {
  return remove(env, `/rest/v1/announcement?id=eq.${id}`);
}

// ============================================================
// 11. 統計 (Stats)
// ============================================================
export async function getDashboardStats(env, { lowStockThreshold = 5 } = {}) {
  const todayStart = taipeiDayStart(taipeiToday());
  const [todayTx, outstandingDebt, lowStock] = await Promise.all([
    listTransactionsSince(env, todayStart),
    totalOutstandingDebt(env),
    findLowStock(env, lowStockThreshold)
  ]);
  return {
    today_revenue: todayTx.reduce((s, t) => s + (t.total || 0), 0),
    today_transaction_count: todayTx.length,
    outstanding_debt: outstandingDebt,
    low_stock: lowStock
  };
}

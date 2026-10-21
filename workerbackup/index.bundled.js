// workerbackup/common.js
function authHeaders(env) {
  return {
    "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
  };
}
async function query(env, path) {
  const r = await fetch(`${env.SUPABASE_URL}${path}`, { headers: authHeaders(env) });
  return r.json();
}
async function post(env, path, body) {
  return fetch(`${env.SUPABASE_URL}${path}`, {
    method: "POST",
    headers: { ...authHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
async function postReturn(env, path, body) {
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
    console.error(`[supabase] postReturn ${path} \u5931\u6557 status=${r.status}:`, JSON.stringify(data));
    throw new Error(`Supabase postReturn \u5931\u6557 (${r.status}): ${data?.message || data?.hint || "unknown"}`);
  }
  return data[0];
}
async function patch(env, path, body) {
  return fetch(`${env.SUPABASE_URL}${path}`, {
    method: "PATCH",
    headers: { ...authHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
async function remove(env, path) {
  return fetch(`${env.SUPABASE_URL}${path}`, {
    method: "DELETE",
    headers: authHeaders(env)
  });
}
async function uploadPublic(env, bucket, path, blob, contentType = "image/jpeg", upsert = false) {
  const headers = { ...authHeaders(env), "Content-Type": contentType };
  if (upsert) headers["x-upsert"] = "true";
  await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers,
    body: blob
  });
  return `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
var TZ = "Asia/Taipei";
function taipeiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(/* @__PURE__ */ new Date());
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}
function taipeiDayStart(dateStr) {
  return `${dateStr}T00:00:00+08:00`;
}
function taipeiDayEnd(dateStr) {
  return `${dateStr}T23:59:59.999+08:00`;
}
function trimDate(iso) {
  if (!iso) return "?";
  const [_y, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}
var PRODUCT_CATEGORIES = ["\u96F6\u98DF", "\u73A9\u5177", "\u65E5\u7528\u54C1", "\u7279\u8272\u5546\u54C1", "\u8ABF\u5473\u6599", "\u6CE1\u9EB5"];
var APPROVAL_LABEL = {
  pending: "\u5F85\u5BE9\u6838",
  approved: "\u5DF2\u4E0A\u67B6",
  rejected: "\u5DF2\u99C1\u56DE"
};
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}
var REPLY_URL = "https://api.line.me/v2/bot/message/reply";
var PUSH_URL = "https://api.line.me/v2/bot/message/push";
var CONTENT_URL = (messageId) => `https://api-data.line.me/v2/bot/message/${messageId}/content`;
function tokenFor(env, channel) {
  return channel === "consignor" ? env.LINE_CONSIGNOR_CHANNEL_ACCESS_TOKEN : env.LINE_CHANNEL_ACCESS_TOKEN;
}
function authHeaders2(env, channel) {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${tokenFor(env, channel)}`
  };
}
async function reply(env, channel, replyToken, messages) {
  return fetch(REPLY_URL, {
    method: "POST",
    headers: authHeaders2(env, channel),
    body: JSON.stringify({ replyToken, messages })
  });
}
async function replyText(env, channel, replyToken, text) {
  return reply(env, channel, replyToken, [{ type: "text", text }]);
}
async function push(env, channel, to, messages) {
  return fetch(PUSH_URL, {
    method: "POST",
    headers: authHeaders2(env, channel),
    body: JSON.stringify({ to, messages })
  });
}
async function fetchContent(env, channel, messageId) {
  const r = await fetch(CONTENT_URL(messageId), {
    headers: { "Authorization": `Bearer ${tokenFor(env, channel)}` }
  });
  return r.blob();
}
async function replyManagerOnly(env, channel, event) {
  return replyText(env, channel, event.replyToken, "\u26D4 \u6B64\u529F\u80FD\u50C5\u9650\u5E97\u9577\u64CD\u4F5C\u3002");
}
async function replyConsignorOnly(env, channel, event) {
  return replyText(env, channel, event.replyToken, "\u26D4 \u6B64\u529F\u80FD\u50C5\u9650\u5BC4\u8CE3\u8005\u64CD\u4F5C\u3002");
}
function kv(label, value) {
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
async function getByLineId(env, lineId) {
  const r = await query(env, `/rest/v1/users?line_id=eq.${lineId}&select=*`);
  return r[0] || null;
}
async function autoRegister(env, lineId, role = "consignor") {
  const newUser = { line_id: lineId, nickname: "\u65B0\u5925\u4F34", role };
  await post(env, "/rest/v1/users", newUser);
  return newUser;
}
async function listManagers(env) {
  return query(env, "/rest/v1/users?role=eq.manager&select=line_id");
}
async function setState(env, lineId, lastCommand, tempData) {
  const body = { last_command: lastCommand };
  if (tempData !== void 0) body.temp_data = tempData;
  return patch(env, `/rest/v1/users?line_id=eq.${lineId}`, body);
}
async function resetState(env, lineId) {
  return patch(env, `/rest/v1/users?line_id=eq.${lineId}`, { last_command: null });
}
async function updateNickname(env, lineId, nickname) {
  return patch(env, `/rest/v1/users?line_id=eq.${encodeURIComponent(lineId)}`, { nickname });
}
function isManager(user) {
  return (user?.role || "").toLowerCase() === "manager";
}
function isConsignor(user) {
  return (user?.role || "").toLowerCase() === "consignor";
}
async function listProducts(env) {
  return query(env, "/rest/v1/products?select=id,name,stock,image_url,category&order=category,name");
}
async function listForPos(env) {
  const r = await query(
    env,
    "/rest/v1/products?is_active=eq.true&approval_status=eq.approved&select=id,name,price,category,image_url&order=category,name"
  );
  return Array.isArray(r) ? r : [];
}
async function listAllProducts(env) {
  return query(env, "/rest/v1/products?select=*&order=category,name");
}
async function getConsignorMap(env, ids) {
  if (!ids || !ids.length) return /* @__PURE__ */ new Map();
  const rows = await query(env, `/rest/v1/products?id=in.(${ids.join(",")})&select=id,consignor_line_id`);
  return new Map((Array.isArray(rows) ? rows : []).map((p) => [p.id, p.consignor_line_id]));
}
async function getProductById(env, id) {
  const r = await query(env, `/rest/v1/products?id=eq.${id}`);
  return r[0] || null;
}
async function assignProductLabel(env, productId) {
  const label = `product_${productId}`;
  for (const [path, body] of [
    [`/rest/v1/products?id=eq.${productId}`, { label_name: label }],
    [`/rest/v1/training_data?product_id=eq.${productId}`, { english_name: label }]
  ]) {
    const response = await patch(env, path, body);
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`\u66F4\u65B0\u5546\u54C1\u6A19\u7C64\u5931\u6557 (${response.status}): ${detail}`);
    }
  }
}
async function createProduct(env, { name, price, category, stock }) {
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
    throw new Error(`\u5EFA\u7ACB\u5546\u54C1\u8A13\u7DF4\u8CC7\u6599\u5931\u6557 (${trainingResponse.status}): ${await trainingResponse.text()}`);
  }
  await assignProductLabel(env, product.id);
  return product;
}
async function createPendingProduct(env, { name, price, category, stock, consignorLineId }) {
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
    throw new Error(`\u5EFA\u7ACB\u5546\u54C1\u8A13\u7DF4\u8CC7\u6599\u5931\u6557 (${trainingResponse.status}): ${await trainingResponse.text()}`);
  }
  await assignProductLabel(env, product.id);
  return product;
}
async function approveProduct(env, id) {
  await patch(env, `/rest/v1/products?id=eq.${id}`, {
    approval_status: "approved",
    is_active: true,
    rejected_reason: null
  });
  return getProductById(env, id);
}
async function rejectProduct(env, id, reason) {
  await patch(env, `/rest/v1/products?id=eq.${id}`, {
    approval_status: "rejected",
    is_active: false,
    rejected_reason: reason || ""
  });
  return getProductById(env, id);
}
async function listPendingProducts(env) {
  return query(env, "/rest/v1/products?approval_status=eq.pending&select=*&order=id.desc");
}
async function adjustStock(env, id, delta) {
  const rows = await query(env, `/rest/v1/products?id=eq.${id}&select=stock`);
  if (!rows.length) return null;
  const newStock = (rows[0].stock || 0) + delta;
  await patch(env, `/rest/v1/products?id=eq.${id}`, { stock: newStock });
  return newStock;
}
async function recordRestock(env, productId, quantity) {
  return post(env, "/rest/v1/stock", {
    product_id: productId,
    quantity,
    restock_date: taipeiToday()
  });
}
async function setImageUrl(env, id, url) {
  return patch(env, `/rest/v1/products?id=eq.${id}`, { image_url: url });
}
var UPDATABLE_FIELDS = ["name", "price", "category", "stock", "image_url", "trained", "is_active", "consignor_line_id"];
var INT_FIELDS = /* @__PURE__ */ new Set(["price", "stock"]);
var BOOL_FIELDS = /* @__PURE__ */ new Set(["trained", "is_active"]);
async function updateProduct(env, id, patch2) {
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
async function removeProduct(env, id) {
  return remove(env, `/rest/v1/products?id=eq.${id}`);
}
async function findLowStock(env, threshold = 5) {
  return query(env, `/rest/v1/products?stock=lte.${threshold}&select=id,name,stock&order=stock`);
}
async function enqueueEmbeddingJob(env, productId) {
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
    console.warn(`[embedding_job] \u6392\u7A0B\u901A\u77E5 (${response.status}): ${detail}`);
  }
}
async function getOrCreateForProduct(env, productId) {
  const existing = (await query(env, `/rest/v1/training_data?product_id=eq.${productId}`))[0];
  if (existing) return existing;
  return postReturn(env, "/rest/v1/training_data", {
    product_id: productId,
    english_name: `product_${productId}`
  });
}
function nextEmptyImageField(trainData) {
  if (!trainData.image1) return "image1";
  if (!trainData.image2) return "image2";
  if (!trainData.image3) return "image3";
  if (!trainData.image4) return "image4";
  if (!trainData.image5) return "image5";
  if (!trainData.image6) return "image6";
  return null;
}
async function attachImage(env, channel, { messageId, productId, trainDataId, field }) {
  const blob = await fetchContent(env, channel, messageId);
  const path = `${productId}/${field}.jpg`;
  const url = await uploadPublic(env, "products", path, blob, "image/jpeg", true);
  await patch(env, `/rest/v1/training_data?id=eq.${trainDataId}`, { [field]: url });
  return url;
}
async function listMembers(env) {
  return query(env, "/rest/v1/member?select=id,nickname,total_debt&order=nickname");
}
async function listAllNicknames(env) {
  return query(env, "/rest/v1/member?select=nickname");
}
async function getMemberById(env, id) {
  const r = await query(env, `/rest/v1/member?id=eq.${id}`);
  return r[0] || null;
}
async function getMemberByNickname(env, nickname) {
  const r = await query(env, `/rest/v1/member?nickname=eq.${nickname}&select=*`);
  return r[0] || null;
}
async function addDebtForTransaction(env, { memberId, txId, amount }) {
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
async function repayDebt(env, id, amount) {
  const member = await getMemberById(env, id);
  if (!member) return null;
  const newTotalDebt = Math.max(0, (member.total_debt || 0) - amount);
  await patch(env, `/rest/v1/member?id=eq.${id}`, { total_debt: newTotalDebt });
  return newTotalDebt;
}
async function totalOutstandingDebt(env) {
  const all = await query(env, "/rest/v1/member?select=total_debt");
  return all.reduce((s, m) => s + (m.total_debt || 0), 0);
}
async function uploadEvidence(env, blob) {
  const path = `evidence_${Date.now()}.jpg`;
  return uploadPublic(env, "evidence", path, blob, "image/jpeg");
}
async function createTransaction(env, { type, total, cart, photoBlob }) {
  const photoUrl = await uploadEvidence(env, photoBlob);
  const tx = await postReturn(env, "/rest/v1/transaction", {
    type,
    total: parseInt(total),
    item_list: JSON.stringify(cart),
    checkout_image: photoUrl,
    identity: type === "credit" ? "\u5F85\u78BA\u8A8D\u65CF\u4EBA" : "\u904A\u5BA2"
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
async function getTransactionById(env, id) {
  const r = await query(env, `/rest/v1/transaction?id=eq.${id}`);
  return r[0] || null;
}
async function listTransactions(env, { from, to } = {}) {
  let path = "/rest/v1/transaction?select=*&order=created_at.desc";
  if (from) path += `&created_at=gte.${encodeURIComponent(taipeiDayStart(from))}`;
  if (to) path += `&created_at=lte.${encodeURIComponent(taipeiDayEnd(to))}`;
  return query(env, path);
}
async function listTransactionsSince(env, isoDate) {
  return query(env, `/rest/v1/transaction?created_at=gte.${encodeURIComponent(isoDate)}&select=total`);
}
async function setTransactionIdentity(env, id, identity) {
  return patch(env, `/rest/v1/transaction?id=eq.${id}`, { identity });
}
async function createAnnouncement(env, { title = "\u5E97\u9577\u5EE3\u64AD", description }) {
  return post(env, "/rest/v1/announcement", {
    title,
    description,
    upload_time: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function listAnnouncements(env) {
  return query(env, "/rest/v1/announcement?select=*&order=upload_time.desc");
}
async function getDashboardStats(env, { lowStockThreshold = 5 } = {}) {
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

// workerbackup/manager.js
function formatItemsBlock(cart) {
  if (!Array.isArray(cart) || cart.length === 0) return "\uFF08\u7121\u660E\u7D30\uFF09";
  return cart.map((it) => {
    const name = it.name || `#${it.id}`;
    const qty = it.quantity || 1;
    const subtotal = (it.price || 0) * qty;
    return `${name} \xD7 ${qty} = $${subtotal}`;
  }).join("\n");
}
async function buildDebtorQuickReply(env, txId) {
  const memberList = await listAllNicknames(env);
  return {
    items: memberList.slice(0, 12).map((m) => ({
      type: "action",
      action: {
        type: "postback",
        label: m.nickname,
        data: `action=confirm_debtor&tx_id=${txId}&name=${m.nickname}`,
        displayText: `\u9019\u662F ${m.nickname}`
      }
    }))
  };
}
async function sendPicker(env, replyToken, title, items, actionType) {
  const rows = items.map((item) => {
    const mainTitle = item.nickname || item.name;
    const subTitle = item.total_debt !== void 0 ? `\u6B20\u6B3E: $${item.total_debt}` : `\u5EAB\u5B58: ${item.stock}`;
    return {
      type: "box",
      layout: "horizontal",
      paddingAll: "12px",
      contents: [
        {
          type: "box",
          layout: "vertical",
          contents: [{
            type: "image",
            url: item.image_url || "https://via.placeholder.com/150",
            aspectMode: "cover"
          }],
          width: "45px",
          height: "45px",
          cornerRadius: "4px"
        },
        {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: mainTitle, weight: "bold", size: "sm" },
            { type: "text", text: subTitle, size: "xs", color: "#888888" }
          ],
          margin: "md"
        }
      ],
      action: {
        type: "postback",
        data: `action=${actionType}&id=${item.id}&name=${mainTitle}`,
        displayText: `\u9078\u53D6 ${mainTitle}`
      }
    };
  });
  const bodyContents = rows.flatMap((r, i) => i === 0 ? [r] : [{ type: "separator" }, r]).slice(0, 25);
  const flex = {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "text", text: title, weight: "bold", size: "lg", color: "#1DB446" }]
      },
      body: { type: "box", layout: "vertical", spacing: "sm", contents: bodyContents }
    }
  };
  return reply(env, "manager", replyToken, [flex]);
}
async function notifyManagerOfCheckout(env, { managerLineId, type, total, photoUrl, txId, cart }) {
  const isCredit = type === "credit";
  const itemsBlock = formatItemsBlock(cart);
  let text = `\u{1F514} \u7D50\u5E33\u901A\u77E5\uFF08${isCredit ? "\u8CD2\u5E33" : "\u73FE\u91D1"}\uFF09
\u91D1\u984D\uFF1A$${total}

\u8CFC\u8CB7\u5546\u54C1\uFF1A
${itemsBlock}`;
  if (isCredit) text += "\n\n\u8ACB\u9EDE\u9078\u5C0D\u61C9\u65CF\u4EBA \u2193";
  const quickReply = isCredit ? await buildDebtorQuickReply(env, txId) : null;
  const messages = [
    { type: "image", originalContentUrl: photoUrl, previewImageUrl: photoUrl },
    { type: "text", text, ...quickReply ? { quickReply } : {} }
  ];
  return push(env, "manager", managerLineId, messages);
}
async function notifyManagerReview(env, { managerLineId, product, coverPhotoUrl, consignorNickname }) {
  const p = product;
  const bubble = {
    type: "bubble",
    ...coverPhotoUrl ? {
      hero: {
        type: "image",
        url: coverPhotoUrl,
        size: "full",
        aspectRatio: "1:1",
        aspectMode: "cover"
      }
    } : {},
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "text", text: "\u{1F195} \u65B0\u5BC4\u8CE3\u5546\u54C1\u5F85\u5BE9", weight: "bold", color: "#1DB446", size: "sm" },
        { type: "text", text: p.name, weight: "bold", size: "xl", wrap: true },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            kv("\u5BC4\u8CE3\u8005", consignorNickname || p.consignor_line_id || "\u2014"),
            kv("\u552E\u50F9", `$${p.price}`),
            kv("\u5206\u985E", p.category || "\u2014"),
            kv("\u521D\u59CB\u5EAB\u5B58", `${p.stock}`)
          ]
        }
      ]
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "secondary",
          height: "sm",
          action: { type: "postback", label: "\u99C1\u56DE", data: `action=reject_product&product_id=${p.id}`, displayText: "\u99C1\u56DE" }
        },
        {
          type: "button",
          style: "primary",
          color: "#1DB446",
          height: "sm",
          action: { type: "postback", label: "\u540C\u610F\u4E0A\u67B6", data: `action=approve_product&product_id=${p.id}`, displayText: "\u540C\u610F\u4E0A\u67B6" }
        }
      ]
    }
  };
  return push(env, "manager", managerLineId, [{ type: "flex", altText: `\u65B0\u5BC4\u8CE3\u5546\u54C1\u5F85\u5BE9\uFF1A${p.name}`, contents: bubble }]);
}
async function notifyManagerEmbeddingComplete(env, { productId, success, error }) {
  const product = await getProductById(env, productId);
  if (!product) return;
  const text = success ? `\u{1F389}\u3010\u5546\u54C1 AI \u5B78\u7FD2\u5B8C\u6210\u3011
\u5546\u54C1\u540D\u7A31\uFF1A\u300C${product.name}\u300D
\u73FE\u5834\u93E1\u982D\u5DF2\u6210\u529F\u5EFA\u7ACB 120 \u7D44\u7279\u5FB5\u6A21\u578B\uFF01\u73FE\u5728\u5373\u53EF\u5728\u6536\u9280\u6A5F\u524D\u653E\u4E0A\u5546\u54C1\u9032\u884C\u8996\u89BA\u7D50\u5E33\u56C9\uFF01\u2728` : `\u26A0\uFE0F\u3010\u5546\u54C1 AI \u5B78\u7FD2\u5931\u6557\u3011
\u5546\u54C1\u540D\u7A31\uFF1A\u300C${product.name}\u300D
\u7279\u5FB5\u751F\u6210\u5931\u6557\uFF08${error || "\u672A\u77E5\u539F\u56E0"}\uFF09\uFF0C\u8ACB\u6AA2\u67E5\u7167\u7247\u6216\u91CD\u65B0\u62CD\u651D\u3002`;
  const managers = await listManagers(env);
  for (const m of managers) {
    try {
      await push(env, "manager", m.line_id, [{ type: "text", text }]);
    } catch (err) {
      console.error(`[manager-notify] push failed for manager ${m.line_id}:`, err);
    }
  }
}
async function handleManagerEvent(env, event, user, userId) {
  const channel = "manager";
  if (event.type === "follow") {
    return new Response("OK");
  }
  if (event.type === "postback") {
    return handleManagerPostback(env, event, user, userId, channel);
  }
  if (event.type === "message" && event.message.type === "text") {
    return handleManagerText(env, event, user, userId, user.last_command, channel);
  }
  if (event.type === "message" && event.message.type === "image") {
    return handleManagerImage(env, event, user, userId, channel);
  }
  return new Response("OK");
}
async function handleManagerPostback(env, event, user, userId, channel) {
  if (!isManager(user)) return await replyManagerOnly(env, channel, event);
  const data = event.postback.data;
  const params = new URLSearchParams(data);
  const action = params.get("action");
  if (action === "confirm_debtor") {
    const txId = params.get("tx_id");
    const name = params.get("name");
    const tx = await getTransactionById(env, txId);
    const member = await getMemberByNickname(env, name);
    if (tx && member) {
      await addDebtForTransaction(env, { memberId: member.id, txId, amount: tx.total });
      await setTransactionIdentity(env, txId, name);
      return await replyText(env, channel, event.replyToken, `\u2705 \u5E33\u52D9\u66F4\u65B0\u6210\u529F\uFF01
\u65CF\u4EBA\uFF1A${name}
\u91D1\u984D\uFF1A$${tx.total}`);
    }
    return new Response("OK");
  }
  if (data === "action=inventory") {
    const list = await listProducts(env);
    return await sendPicker(env, event.replyToken, "\u{1F4E6} \u9078\u64C7\u88DC\u8CA8\u5546\u54C1", list, "select_stock_item");
  }
  if (action === "select_stock_item") {
    await setState(env, userId, "WAITING_STOCK_QTY", {
      id: params.get("id"),
      name: params.get("name")
    });
    return await replyText(env, channel, event.replyToken, `\u{1F4DD} \u5DF2\u9078\uFF1A${params.get("name")}
\u8ACB\u8F38\u5165\u8981\u300C\u589E\u52A0\u300D\u7684\u5EAB\u5B58\u6578\u91CF\uFF1A`);
  }
  if (data === "action=debt_menu") {
    const list = await listMembers(env);
    return await sendPicker(env, event.replyToken, "\u{1F4B8} \u9078\u64C7\u9664\u5E33\u65CF\u4EBA", list, "select_member_repay");
  }
  if (action === "select_member_repay") {
    await setState(env, userId, "WAITING_DEBT_INFO", {
      id: params.get("id"),
      name: params.get("name")
    });
    return await replyText(env, channel, event.replyToken, `\u{1F4B8} \u5DF2\u9078\uFF1A${params.get("name")}
\u8ACB\u8F38\u5165\u65CF\u4EBA\u300C\u9084\u6B3E\u300D\u7684\u91D1\u984D\uFF1A`);
  }
  if (data === "action=new_product_menu") {
    await setState(env, userId, "WAITING_PRODUCT_INFO");
    return await replyText(
      env,
      channel,
      event.replyToken,
      "\u{1F4DD} \u8ACB\u8F38\u5165\u65B0\u5546\u54C1\u8CC7\u8A0A\uFF1A\n[\u540D\u7A31] [\u50F9\u683C] [\u5206\u985E] [\u5EAB\u5B58]\n\n\u5206\u985E\uFF1A\u96F6\u98DF\u3001\u73A9\u5177\u3001\u65E5\u7528\u54C1\u3001\u7279\u8272\u5546\u54C1\u3001\u8ABF\u5473\u6599\u3001\u6CE1\u9EB5"
    );
  }
  if (data === "action=bulletin" || data === "bulletin") {
    await setState(env, userId, "WAITING_BULLETIN");
    return await replyText(env, channel, event.replyToken, "\u{1F4E2} \u8ACB\u76F4\u63A5\u8F38\u5165\u5E03\u544A\u6B04\u516C\u544A\u5167\u5BB9\uFF1A");
  }
  if (action === "approve_product") {
    const productId = params.get("product_id");
    const product = await getProductById(env, productId);
    if (!product) return await replyText(env, channel, event.replyToken, "\u274C \u627E\u4E0D\u5230\u5546\u54C1\u3002");
    if (product.approval_status !== "pending") {
      return await replyText(env, channel, event.replyToken, `\u6B64\u5546\u54C1\u5DF2\u88AB\u8655\u7406\uFF08\u76EE\u524D\u72C0\u614B\uFF1A${APPROVAL_LABEL[product.approval_status] || product.approval_status}\uFF09\u3002`);
    }
    try {
      const trainingRows = await query(env, `/rest/v1/training_data?product_id=eq.${productId}&select=image1,image2,image3,image4,image5,image6`);
      const trainingRow = Array.isArray(trainingRows) ? trainingRows[0] : null;
      if (!trainingRow || ![1, 2, 3, 4, 5, 6].every((n) => trainingRow[`image${n}`])) {
        return await replyText(env, channel, event.replyToken, "\u274C \u5C1A\u672A\u6536\u9F4A\u516D\u5F35\u7167\u7247\uFF0C\u7121\u6CD5\u6838\u51C6\u3002");
      }
      await enqueueEmbeddingJob(env, productId);
      await approveProduct(env, productId);
    } catch (err) {
      console.error("[approval] failed:", err);
      return await replyText(env, channel, event.replyToken, `\u274C \u6838\u51C6\u5931\u6557\uFF1A${err.message}`);
    }
    return await replyText(env, channel, event.replyToken, `\u2705 \u5DF2\u540C\u610F\u4E0A\u67B6\uFF1A${product.name}
\u23F3 \u5DF2\u81EA\u52D5\u6D3E\u5DE5\u7D66\u73FE\u5834\u6A39\u8393\u6D3E\u9032\u884C AI \u8996\u89BA\u7279\u5FB5\u8A13\u7DF4\uFF01`);
  }
  if (action === "reject_product") {
    const productId = params.get("product_id");
    const product = await getProductById(env, productId);
    if (!product) return await replyText(env, channel, event.replyToken, "\u274C \u627E\u4E0D\u5230\u5546\u54C1\u3002");
    if (product.approval_status !== "pending") {
      return await replyText(env, channel, event.replyToken, `\u6B64\u5546\u54C1\u5DF2\u88AB\u8655\u7406\uFF08\u76EE\u524D\u72C0\u614B\uFF1A${APPROVAL_LABEL[product.approval_status] || product.approval_status}\uFF09\u3002`);
    }
    await setState(env, userId, "WAITING_REJECT_REASON", { productId });
    return await replyText(env, channel, event.replyToken, "\u{1F4DD} \u8ACB\u8F38\u5165\u99C1\u56DE\u539F\u56E0\uFF08\u6703\u5BEB\u5165 DB \u4E26\u901A\u77E5\u5BC4\u8CE3\u8005\uFF09\uFF1A");
  }
  return new Response("OK");
}
async function handleManagerText(env, event, user, userId, currentState, channel) {
  if (!isManager(user)) return await replyManagerOnly(env, channel, event);
  const userMsg = (event.message.text || "").trim();
  const p = userMsg.split(/\s+/);
  if (currentState === "WAITING_PRODUCT_INFO") {
    if (p.length < 4 || !PRODUCT_CATEGORIES.includes(p[2])) {
      return await replyText(env, channel, event.replyToken, "\u274C \u683C\u5F0F\u932F\u8AA4\u3002\u8ACB\u8F38\u5165\uFF1A[\u540D\u7A31] [\u50F9\u683C] [\u5206\u985E] [\u5EAB\u5B58]\n\u4F8B\u5982\uFF1A\u624B\u5DE5\u9905\u4E7E 50 \u96F6\u98DF 20");
    }
    const product = await createProduct(env, { name: p[0], price: p[1], category: p[2], stock: p[3] });
    await setState(env, userId, "WAITING_PRODUCT_PHOTOS", { productId: product.id, photoCount: 0 });
    return await replyText(env, channel, event.replyToken, `\u2705\u3010${p[0]}\u3011\u5EFA\u7ACB\u6210\u529F\uFF01

\u8ACB\u5148\u4E0A\u50B3\u5546\u54C1\u7684\u300C\u6B63\u9762\u7167\u300D1 \u5F35 \u{1F4F8}`);
  }
  if (currentState === "WAITING_STOCK_QTY") {
    const qty = parseInt(userMsg);
    if (isNaN(qty)) return await replyText(env, channel, event.replyToken, "\u274C \u8ACB\u8F38\u5165\u6578\u5B57\u3002");
    const { id, name } = user.temp_data || {};
    const newStock = await adjustStock(env, id, qty);
    await recordRestock(env, id, qty);
    await resetState(env, userId);
    return await replyText(env, channel, event.replyToken, `\u{1F4E6} ${name} \u66F4\u65B0\u6210\u529F\uFF01\u76EE\u524D\u5EAB\u5B58\uFF1A${newStock}`);
  }
  if (currentState === "WAITING_DEBT_INFO") {
    const qty = parseInt(userMsg);
    if (isNaN(qty) || qty <= 0) return await replyText(env, channel, event.replyToken, "\u274C \u8ACB\u8F38\u5165\u6B63\u78BA\u91D1\u984D\u3002");
    const { id, name } = user.temp_data || {};
    const newTotalDebt = await repayDebt(env, id, qty);
    await resetState(env, userId);
    return await replyText(env, channel, event.replyToken, `\u{1F4B8}\u3010\u9664\u5E33\u6210\u529F\u3011
\u65CF\u4EBA\uFF1A${name}
\u76EE\u524D\u7E3D\u6B20\u6B3E\uFF1A$${newTotalDebt}`);
  }
  if (currentState === "WAITING_BULLETIN") {
    await createAnnouncement(env, { description: userMsg });
    await resetState(env, userId);
    return await replyText(env, channel, event.replyToken, "\u2705 \u516C\u544A\u767C\u5E03\u6210\u529F\uFF01\u73FE\u5834\u5E73\u677F\u5DF2\u540C\u6B65\u66F4\u65B0\u3002");
  }
  if (currentState === "WAITING_REJECT_REASON") {
    const { productId } = user.temp_data || {};
    if (!productId) {
      await resetState(env, userId);
      return await replyText(env, channel, event.replyToken, "\u627E\u4E0D\u5230\u8981\u99C1\u56DE\u7684\u5546\u54C1\uFF0C\u52D5\u4F5C\u53D6\u6D88\u3002");
    }
    await rejectProduct(env, productId, userMsg);
    await resetState(env, userId);
    return await replyText(env, channel, event.replyToken, `\u2705 \u5DF2\u99C1\u56DE\u5546\u54C1\uFF0C\u539F\u56E0\uFF1A${userMsg}`);
  }
  if (userMsg.startsWith("\u67E5\u8A62")) {
    const m = await getMemberByNickname(env, p[1]);
    if (m) {
      return await replyText(env, channel, event.replyToken, `\u{1F464} ${p[1]} \u6B20\u6B3E\uFF1A$${m.total_debt}`);
    }
    return await replyText(env, channel, event.replyToken, `\u627E\u4E0D\u5230\u65CF\u4EBA\u300C${p[1]}\u300D`);
  }
  if (userMsg.startsWith("\u5B78\u7FD2\u9032\u5EA6") || userMsg.startsWith("\u9032\u5EA6")) {
    const keyword = userMsg.replace(/^(學習進度|進度)\s*/, "").trim();
    const products = await query(env, `/rest/v1/products?name=ilike.*${encodeURIComponent(keyword)}*&select=id,name,trained,approval_status`);
    if (!products || products.length === 0) {
      return await replyText(env, channel, event.replyToken, `\u627E\u4E0D\u5230\u8207\u300C${keyword}\u300D\u76F8\u95DC\u7684\u5546\u54C1`);
    }
    const prod = products[0];
    const jobs = await query(env, `/rest/v1/embedding_jobs?product_id=eq.${prod.id}&order=id.desc&limit=1`);
    const job = jobs?.[0];
    let statusText = "\u672A\u77E5";
    if (prod.trained) statusText = "\u{1F7E2} \u5DF2\u5B8C\u6210\u5B78\u7FD2\uFF08\u73FE\u5834\u93E1\u982D\u53EF\u76F4\u63A5\u8FA8\u8B58\u7D50\u5E33\uFF09";
    else if (job?.status === "processing") statusText = "\u{1F7E1} AI \u6B63\u5728\u5B78\u7FD2\u4E2D\uFF08120 \u7D44\u7279\u5FB5\u904B\u7B97\u4E2D\uFF09";
    else if (job?.status === "pending") statusText = "\u23F3 \u6392\u968A\u7B49\u5F85\u6A39\u8393\u6D3E\u8655\u7406\u4E2D";
    else if (job?.status === "failed") statusText = `\u274C \u5B78\u7FD2\u5931\u6557\uFF1A${job.last_error || "\u8ACB\u91CD\u62CD\u7167\u7247"}`;
    else if (prod.approval_status === "pending") statusText = "\u{1F4CB} \u7B49\u5F85\u5E97\u9577\u5BE9\u6838\u4E2D";
    return await replyText(env, channel, event.replyToken, `\u{1F4E6} \u5546\u54C1\uFF1A${prod.name}
\u{1F4CA} AI \u8FA8\u8B58\u72C0\u614B\uFF1A${statusText}`);
  }
  return new Response("OK");
}
async function handleManagerImage(env, event, user, userId, channel) {
  if (user.last_command !== "WAITING_PRODUCT_PHOTOS") {
    return new Response("OK");
  }
  const { productId, photoCount = 0 } = user.temp_data || {};
  if (!productId) {
    return new Response("OK");
  }
  let trainData;
  try {
    trainData = await getOrCreateForProduct(env, productId);
  } catch (err) {
    console.error(`[image] getOrCreateForProduct throw:`, err);
    return await replyText(env, channel, event.replyToken, `\u274C \u8B80\u53D6\u8A13\u7DF4\u8CC7\u6599\u5931\u6557\uFF1A${err?.message || "unknown"}`);
  }
  const field = nextEmptyImageField(trainData);
  if (!field) {
    console.warn(`[image] 6 \u500B\u7167\u7247\u69FD\u4F4D\u5DF2\u6EFF`);
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
    console.error(`[image] attachImage error:`, err);
    return await replyText(env, channel, event.replyToken, `\u274C \u5B58\u7167\u7247\u5931\u6557\uFF1A${err?.message || "unknown"}`);
  }
  const product = await getProductById(env, productId);
  if (product && (!product.image_url || field === "image1")) {
    await setImageUrl(env, productId, url);
  }
  const productName = product?.name || "";
  let replyMsg;
  if (field === "image1") {
    replyMsg = `\u2705 \u5DF2\u6536\u5230\u300C${productName}\u300D\u7684\u6B63\u9762\u7167

\u63A5\u4E0B\u4F86\u8ACB\u4E0A\u50B3\u5074\u9762\u7167 5 \u5F35 \u{1F4F8}`;
  } else if (field === "image2") {
    replyMsg = `\u{1F4F8} \u5DF2\u6536\u5230\u5074\u9762\u7167\uFF081/5\uFF09`;
  } else if (field === "image3") {
    replyMsg = `\u{1F4F8} \u5DF2\u6536\u5230\u5074\u9762\u7167\uFF082/5\uFF09`;
  } else if (field === "image4") {
    replyMsg = `\u{1F4F8} \u5DF2\u6536\u5230\u5074\u9762\u7167\uFF083/5\uFF09`;
  } else if (field === "image5") {
    replyMsg = `\u{1F4F8} \u5DF2\u6536\u5230\u5074\u9762\u7167\uFF084/5\uFF09`;
  } else {
    replyMsg = `\u2705\u3010${productName}\u30116 \u5F35\u7167\u7247\u5168\u6578\u6536\u9F4A\uFF01
\u{1F916} \u73FE\u5834 AI \u7279\u5FB5\u5B78\u7FD2\u5DF2\u81EA\u52D5\u555F\u52D5\uFF01\u6A39\u8393\u6D3E\u6B63\u9032\u884C 120 \u7D44\u65CB\u8F49\u64F4\u589E\u7279\u5FB5\u8A13\u7DF4\uFF0C\u7D04 1~2 \u5206\u9418\u5B8C\u6210\u5F8C\u6703\u5728\u6B64\u63A8\u64AD\u901A\u77E5\u60A8\uFF01\u2728`;
  }
  const isFinal = field === "image6";
  if (isFinal) {
    try {
      await replyText(env, channel, event.replyToken, replyMsg);
    } catch (replyErr) {
      console.error("[image] replyText failed:", replyErr);
    }
    try {
      await enqueueEmbeddingJob(env, productId);
      await resetState(env, userId);
    } catch (bgErr) {
      console.error("[image] background enqueue error:", bgErr);
    }
    return new Response("OK");
  }
  await setState(env, userId, "WAITING_PRODUCT_PHOTOS", { productId, photoCount: photoCount + 1 });
  return await replyText(env, channel, event.replyToken, replyMsg);
}

// workerbackup/consignor.js
async function notifyWelcome(env, lineId) {
  const text = `\u54C8\u56C9\uFF5E\u6B61\u8FCE\u4F86\u5230\u98DB\u9F20\u5546\u5E97 \u{1F332}

\u5728\u9019\u88E1\u4F60\u53EF\u4EE5\u5BC4\u8CE3\u81EA\u5DF1\u7684\u5546\u54C1\uFF1A\u7121\u8AD6\u662F\u9905\u4E7E\u3001\u8FB2\u7522\u54C1\u3001\u624B\u4F5C\u98FE\u54C1\uFF0C\u90FD\u80FD\u900F\u904E\u6211\u5011\u7684\u81EA\u52A9\u5546\u5E97\u8CE3\u7D66\u4F86\u8A2A\u7684\u5BA2\u4EBA\u3002

\u5E97\u5BB6\u6703\u5E6B\u4F60\u6536\u9280\u3001\u4EE3\u70BA\u7D50\u5E33\uFF0C\u6BCF\u6708\u6708\u5E95\u8DDF\u4F60\u7D50\u7B97\u5206\u6F64 \u{1F4B0}

\u70BA\u4E86\u8B93\u6211\u80FD\u8A18\u4F4F\u4F60\uFF0C\u6211\u53EF\u4EE5\u600E\u9EBC\u7A31\u547C\u4F60\u5462\uFF1F\uFF08\u53EF\u4EE5\u8F38\u5165\u540D\u5B57\u6216\u66B1\u7A31\uFF09`;
  return push(env, "consignor", lineId, [{ type: "text", text }]);
}
async function sendConsignorMenu(env, replyToken, greeting) {
  return reply(env, "consignor", replyToken, [{
    type: "text",
    text: greeting || "\u9700\u8981\u5354\u52A9\u4EC0\u9EBC\u55CE\uFF1F",
    quickReply: {
      items: [
        { type: "action", action: { type: "postback", label: "\u{1F4E4} \u4E0A\u67B6\u5546\u54C1", data: "action=consignor_upload_start", displayText: "\u4E0A\u67B6\u5546\u54C1" } },
        { type: "action", action: { type: "postback", label: "\u{1F4CB} \u6211\u7684\u5546\u54C1", data: "action=consignor_list_own", displayText: "\u67E5\u770B\u6211\u7684\u5546\u54C1" } },
        { type: "action", action: { type: "postback", label: "\u{1F4CA} \u92B7\u552E\u60C5\u6CC1", data: "action=consignor_view_sales", displayText: "\u67E5\u770B\u92B7\u552E" } },
        { type: "action", action: { type: "postback", label: "\u{1F4B0} \u5206\u6F64\u7D00\u9304", data: "action=consignor_view_payouts", displayText: "\u67E5\u770B\u5206\u6F64" } },
        { type: "action", action: { type: "message", label: "\u6539\u66B1\u7A31", text: "/\u6539\u66B1\u7A31" } }
      ]
    }
  }]);
}
async function notifyConsignorRejection(env, consignorLineId, productName, reason) {
  const text = `\u274C \u60A8\u7684\u5546\u54C1\u300C${productName}\u300D\u672A\u901A\u904E\u5BE9\u6838\u3002

\u539F\u56E0\uFF1A${reason || "\uFF08\u5E97\u9577\u672A\u8AAA\u660E\uFF09"}

\u4FEE\u6B63\u5F8C\u53EF\u91CD\u65B0\u4E0A\u50B3\u3002`;
  return push(env, "consignor", consignorLineId, [{ type: "text", text }]);
}
async function getSalesInRange(env, lineId, from, to) {
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
  const nameMap = /* @__PURE__ */ new Map();
  if (productIds.length > 0) {
    const products = await query(
      env,
      `/rest/v1/products?id=in.(${productIds.join(",")})&select=id,name`
    );
    for (const p of Array.isArray(products) ? products : []) {
      nameMap.set(p.id, p.name);
    }
  }
  const itemsByTx = /* @__PURE__ */ new Map();
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
        product_name: nameMap.get(it.product_id) || `(\u5DF2\u522A\u9664\u5546\u54C1 #${it.product_id})`,
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
async function listPayouts(env, { lineId, status } = {}) {
  let path = "/rest/v1/payouts?select=*&order=period_start.desc";
  if (lineId) path += `&consignor_line_id=eq.${encodeURIComponent(lineId)}`;
  if (status) path += `&status=eq.${encodeURIComponent(status)}`;
  return query(env, path);
}
async function dailyConsignorDigest(env) {
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
    const nameMap = /* @__PURE__ */ new Map();
    if (productIds.length > 0) {
      const products = await query(env, `/rest/v1/products?id=in.(${productIds.join(",")})&select=id,name`);
      for (const p of Array.isArray(products) ? products : []) nameMap.set(p.id, p.name);
    }
    const byConsignor = /* @__PURE__ */ new Map();
    for (const it of items) {
      const key = it.consignor_line_id;
      if (!byConsignor.has(key)) byConsignor.set(key, /* @__PURE__ */ new Map());
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
        const name = nameMap.get(pid) || `(\u5DF2\u522A\u9664\u5546\u54C1 #${pid})`;
        lines.push(`${name} \xD7 ${agg.quantity} = $${agg.subtotal}`);
        total += agg.subtotal;
      }
      const header = nickname ? `\u{1F4CA} ${nickname}\uFF0C\u4ECA\u65E5\u92B7\u552E\u6458\u8981\uFF08${today}\uFF09` : `\u{1F4CA} \u4ECA\u65E5\u92B7\u552E\u6458\u8981\uFF08${today}\uFF09`;
      const text = `${header}

${lines.join("\n")}

\u4ECA\u65E5\u7E3D\u92B7\u552E\uFF1A$${total}`;
      pushes.push(push(env, "consignor", lineId, [{ type: "text", text }]));
    }
    await Promise.allSettled(pushes);
  } catch (err) {
    console.error("[daily-digest] failed:", err);
  }
}
async function handleConsignorEvent(env, event, user, userId) {
  const channel = "consignor";
  if (event.type === "follow") {
    await setState(env, userId, "WAITING_NICKNAME");
    await notifyWelcome(env, userId);
    return new Response("OK");
  }
  if (event.type === "postback") {
    return handleConsignorPostback(env, event, user, userId, channel);
  }
  if (event.type === "message" && event.message.type === "text") {
    return handleConsignorText(env, event, user, userId, user.last_command, channel);
  }
  if (event.type === "message" && event.message.type === "image") {
    return handleConsignorImage(env, event, user, userId, channel);
  }
  return new Response("OK");
}
async function handleConsignorPostback(env, event, user, userId, channel) {
  if (!isConsignor(user)) return await replyConsignorOnly(env, channel, event);
  const data = event.postback.data;
  const params = new URLSearchParams(data);
  const action = params.get("action");
  if (action === "consignor_upload_start") {
    await setState(env, userId, "WAITING_CONSIGNOR_PRODUCT_INFO");
    return await replyText(
      env,
      channel,
      event.replyToken,
      "\u{1F4DD} \u8ACB\u8F38\u5165\u5546\u54C1\u8CC7\u8A0A\uFF08\u7528\u7A7A\u683C\u5206\u9694\uFF09\uFF1A\n[\u540D\u7A31] [\u50F9\u683C] [\u5206\u985E] [\u521D\u59CB\u5EAB\u5B58]\n\n\u5206\u985E\uFF1A\u96F6\u98DF\u3001\u73A9\u5177\u3001\u65E5\u7528\u54C1\u3001\u7279\u8272\u5546\u54C1\u3001\u8ABF\u5473\u6599\u3001\u6CE1\u9EB5\n\u4F8B\uFF1A\u624B\u5DE5\u9905\u4E7E 50 \u96F6\u98DF 20"
    );
  }
  if (action === "consignor_view_sales") {
    const today = (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const monthStart = today.slice(0, 7) + "-01";
    const sales = await getSalesInRange(env, userId, monthStart, today);
    if (sales.length === 0) {
      return await replyText(env, channel, event.replyToken, `\u{1F4CA} \u4F60\u7684\u672C\u6708\u92B7\u552E (${monthStart}~${today})

\u672C\u6708\u5C1A\u7121\u92B7\u552E\u3002`);
    }
    const byProduct = /* @__PURE__ */ new Map();
    for (const s of sales) {
      const key = s.product_id;
      const prev = byProduct.get(key) || { name: s.product_name, qty: 0, subtotal: 0 };
      prev.qty += s.quantity;
      prev.subtotal += s.subtotal;
      byProduct.set(key, prev);
    }
    const rows = [...byProduct.values()].sort((a, b) => b.subtotal - a.subtotal);
    const total = rows.reduce((s, x) => s + x.subtotal, 0);
    const lines = rows.map((x) => `${x.name} \xD7 ${x.qty} = $${x.subtotal.toLocaleString()}`);
    const text = `\u{1F4CA} \u4F60\u7684\u672C\u6708\u92B7\u552E (${monthStart.slice(5)}~${today.slice(5)})

\u7E3D\u92B7\u552E\uFF1A$${total.toLocaleString()}

${lines.join("\n")}`;
    return await replyText(env, channel, event.replyToken, text);
  }
  if (action === "consignor_view_payouts") {
    const list = await listPayouts(env, { lineId: userId });
    const recent = (Array.isArray(list) ? list : []).slice(0, 6);
    if (recent.length === 0) {
      return await replyText(env, channel, event.replyToken, "\u{1F4B0} \u4F60\u7684\u5206\u6F64\u7D00\u9304\n\n\u76EE\u524D\u5C1A\u7121\u7D50\u7B97\u7D00\u9304\uFF08\u5E97\u9577\u6708\u5E95\u6703\u7D71\u4E00\u7D50\u7B97\uFF09\u3002");
    }
    const lines = recent.map((pt) => {
      const emoji = pt.status === "paid" ? "\u2705" : "\u23F3";
      const range = `${trimDate(pt.period_start)}~${trimDate(pt.period_end)}`;
      const statusText = pt.status === "paid" ? `\u5DF2\u4ED8 ${trimDate((pt.paid_at || "").slice(0, 10))}` : "\u5F85\u4ED8\u6B3E";
      return `${emoji} ${range} \xB7 \u61C9\u6536 $${(pt.net_payout || 0).toLocaleString()} \xB7 ${statusText}`;
    });
    return await replyText(env, channel, event.replyToken, `\u{1F4B0} \u4F60\u7684\u5206\u6F64\u7D00\u9304

${lines.join("\n")}`);
  }
  if (action === "consignor_list_own") {
    const rows = await query(
      env,
      `/rest/v1/products?consignor_line_id=eq.${encodeURIComponent(userId)}&select=id,name,stock,approval_status,rejected_reason&order=id.desc`
    );
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) {
      return await replyText(env, channel, event.replyToken, "\u4F60\u9084\u6C92\u4E0A\u67B6\u4EFB\u4F55\u5546\u54C1\u3002");
    }
    const lines = list.map((p, i) => {
      const label = APPROVAL_LABEL[p.approval_status] || p.approval_status;
      let extra = "";
      if (p.approval_status === "rejected" && p.rejected_reason) {
        extra = `
   \u21B3 \u99C1\u56DE\u539F\u56E0\uFF1A${p.rejected_reason}`;
      }
      return `${i + 1}. ${p.name}\uFF08\u5EAB\u5B58: ${p.stock}\uFF09[${label}]${extra}`;
    });
    return await replyText(env, channel, event.replyToken, `\u{1F4CB} \u4F60\u7684\u5546\u54C1\u6E05\u55AE\uFF1A

${lines.join("\n")}`);
  }
  return new Response("OK");
}
async function handleConsignorText(env, event, user, userId, currentState, channel) {
  const userMsg = (event.message.text || "").trim();
  const p = userMsg.split(/\s+/);
  if (currentState === "WAITING_NICKNAME" || userMsg === "/\u6539\u66B1\u7A31" || userMsg === "\u6539\u66B1\u7A31") {
    if (userMsg === "/\u6539\u66B1\u7A31" || userMsg === "\u6539\u66B1\u7A31") {
      await setState(env, userId, "WAITING_NICKNAME");
      return await replyText(env, channel, event.replyToken, "\u597D\u7684\uFF0C\u8ACB\u8F38\u5165\u65B0\u66B1\u7A31\uFF1A");
    }
    await updateNickname(env, userId, userMsg);
    await resetState(env, userId);
    return await sendConsignorMenu(env, event.replyToken, `\u592A\u597D\u4E86\uFF0C${userMsg}\uFF01\u4EE5\u4E0B\u662F\u4F60\u53EF\u4EE5\u5728\u98DB\u9F20\u5546\u5E97\u505A\u7684\u4E8B\uFF1A`);
  }
  if (currentState === "WAITING_CONSIGNOR_PRODUCT_INFO") {
    if (!isConsignor(user)) return await replyConsignorOnly(env, channel, event);
    if (p.length < 4 || !PRODUCT_CATEGORIES.includes(p[2])) {
      return await replyText(
        env,
        channel,
        event.replyToken,
        "\u274C \u683C\u5F0F\u932F\u8AA4\u3002\u8ACB\u8F38\u5165\uFF1A[\u540D\u7A31] [\u50F9\u683C] [\u5206\u985E] [\u521D\u59CB\u5EAB\u5B58]\n\u5206\u985E\uFF1A\u96F6\u98DF\u3001\u73A9\u5177\u3001\u65E5\u7528\u54C1\u3001\u7279\u8272\u5546\u54C1\u3001\u8ABF\u5473\u6599\u3001\u6CE1\u9EB5\n\u4F8B\uFF1A\u624B\u5DE5\u9905\u4E7E 50 \u96F6\u98DF 20"
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
      return await replyText(env, channel, event.replyToken, `\u274C \u5EFA\u7ACB\u5546\u54C1\u5931\u6557\uFF1A${err?.message || "unknown"}`);
    }
    await setState(env, userId, "WAITING_PRODUCT_PHOTOS", { productId: product.id, photoCount: 0 });
    return await replyText(env, channel, event.replyToken, `\u2705 \u5546\u54C1\u300C${p[0]}\u300D\u5EFA\u7ACB\u6210\u529F\uFF01

\u8ACB\u5148\u4E0A\u50B3\u5546\u54C1\u7684\u300C\u6B63\u9762\u7167\u300D1 \u5F35 \u{1F4F8}`);
  }
  return sendConsignorMenu(env, event.replyToken);
}
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
    return await replyText(env, channel, event.replyToken, `\u274C \u8B80\u53D6\u8A13\u7DF4\u8CC7\u6599\u5931\u6557\uFF1A${err?.message || "unknown"}`);
  }
  const field = nextEmptyImageField(trainData);
  if (!field) {
    console.warn("[consignor-image] 6 \u500B\u7167\u7247\u69FD\u4F4D\u5DF2\u6EFF");
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
    return await replyText(env, channel, event.replyToken, `\u274C \u5B58\u7167\u7247\u5931\u6557\uFF1A${err?.message || "unknown"}`);
  }
  const product = await getProductById(env, productId);
  if (product && (!product.image_url || field === "image1")) {
    await setImageUrl(env, productId, url);
  }
  const productName = product?.name || "";
  let replyMsg;
  if (field === "image1") {
    replyMsg = `\u2705 \u5DF2\u6536\u5230\u300C${productName}\u300D\u7684\u6B63\u9762\u7167

\u63A5\u4E0B\u4F86\u8ACB\u4E0A\u50B3\u5074\u9762\u7167 5 \u5F35 \u{1F4F8}`;
  } else if (field === "image2") {
    replyMsg = `\u{1F4F8} \u5DF2\u6536\u5230\u5074\u9762\u7167\uFF081/5\uFF09`;
  } else if (field === "image3") {
    replyMsg = `\u{1F4F8} \u5DF2\u6536\u5230\u5074\u9762\u7167\uFF082/5\uFF09`;
  } else if (field === "image4") {
    replyMsg = `\u{1F4F8} \u5DF2\u6536\u5230\u5074\u9762\u7167\uFF083/5\uFF09`;
  } else if (field === "image5") {
    replyMsg = `\u{1F4F8} \u5DF2\u6536\u5230\u5074\u9762\u7167\uFF084/5\uFF09`;
  } else {
    replyMsg = `\u2705 \u5DF2\u6536\u9F4A 6 \u5F35\u7167\u7247\uFF01\u300C${productName}\u300D\u5DF2\u9001\u51FA\u5BE9\u6838\uFF0C\u7B49\u5E97\u9577\u78BA\u8A8D \u{1F332}`;
  }
  const isFinal = field === "image6";
  if (isFinal) {
    try {
      await replyText(env, channel, event.replyToken, replyMsg);
    } catch (err) {
      console.error("[consignor-image] replyText failed:", err);
    }
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

// workerbackup/admin.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
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
async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
async function signJwt(payload, secret, ttlSeconds = 60 * 60 * 24) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const full = { ...payload, iat: now, exp: now + ttlSeconds };
  const headerB64 = bytesToBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = bytesToBase64Url(encoder.encode(JSON.stringify(full)));
  const signing = `${headerB64}.${payloadB64}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signing));
  return `${signing}.${bytesToBase64Url(sig)}`;
}
async function verifyJwt(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(sigB64),
      encoder.encode(`${headerB64}.${payloadB64}`)
    );
    if (!ok) return null;
    const payload = JSON.parse(decoder.decode(base64UrlToBytes(payloadB64)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) return null;
    return payload;
  } catch {
    return null;
  }
}
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
async function handleCheckout(request, env) {
  try {
    const formData = await request.formData();
    const cart = JSON.parse(formData.get("cart_items"));
    const total = formData.get("total_amount");
    const type = formData.get("transaction_type");
    const photo = formData.get("photo");
    const { tx, photoUrl } = await createTransaction(env, { type, total, cart, photoBlob: photo });
    for (const item of cart) {
      await adjustStock(env, item.id, -(item.quantity || 1));
    }
    const managers = await listManagers(env);
    for (const m of managers) {
      await notifyManagerOfCheckout(env, {
        managerLineId: m.line_id,
        type,
        total,
        photoUrl,
        txId: tx.id,
        cart
      });
    }
    return jsonResponse({ status: "success" });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
async function handleAdminApi(request, env, url) {
  const path = url.pathname.replace(/^\/api\/admin/, "") || "/";
  const method = request.method;
  try {
    if (method === "POST" && path === "/login") {
      return await handleLogin(request, env);
    }
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    return await routeAdmin(method, path, request, env, url);
  } catch (err) {
    return jsonResponse({ error: err.message || "internal error" }, 500);
  }
}
async function handleLogin(request, env) {
  if (!env.ADMIN_PASSWORD || !env.JWT_SECRET) {
    return jsonResponse({ error: "admin API not configured (missing ADMIN_PASSWORD or JWT_SECRET)" }, 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  const { password } = body || {};
  if (!password || !timingSafeEqual(password, env.ADMIN_PASSWORD)) {
    return jsonResponse({ error: "invalid password" }, 401);
  }
  const token = await signJwt({ sub: "admin" }, env.JWT_SECRET);
  return jsonResponse({ token, expires_in: 60 * 60 * 24 });
}
async function requireAuth(request, env) {
  if (!env.JWT_SECRET) return jsonResponse({ error: "JWT_SECRET not configured" }, 500);
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return jsonResponse({ error: "missing bearer token" }, 401);
  const payload = await verifyJwt(header.slice(7), env.JWT_SECRET);
  if (!payload) return jsonResponse({ error: "invalid or expired token" }, 401);
  return null;
}
async function routeAdmin(method, path, request, env, url) {
  if (path === "/products") {
    if (method === "GET") {
      const status = url.searchParams.get("status");
      if (status === "pending") return jsonResponse(await listPendingProducts(env));
      return jsonResponse(await listAllProducts(env));
    }
    if (method === "POST") {
      const body = await request.json();
      return jsonResponse(await createProduct(env, body), 201);
    }
  }
  const approveMatch = path.match(/^\/products\/(\d+)\/approve$/);
  if (approveMatch && method === "POST") {
    const id = approveMatch[1];
    const product = await getProductById(env, id);
    if (!product) return jsonResponse({ error: "product not found" }, 404);
    const rows = await query(env, `/rest/v1/training_data?product_id=eq.${id}&select=image1,image2,image3,image4,image5,image6`);
    const training = Array.isArray(rows) ? rows[0] : null;
    if (!training || ![1, 2, 3, 4, 5, 6].every((n) => training[`image${n}`])) {
      return jsonResponse({ error: "six photos required before approval" }, 409);
    }
    await enqueueEmbeddingJob(env, id);
    return jsonResponse(await approveProduct(env, id));
  }
  const rejectMatch = path.match(/^\/products\/(\d+)\/reject$/);
  if (rejectMatch && method === "POST") {
    const body = await request.json();
    const reason = (body.reason || "").trim();
    const product = await getProductById(env, rejectMatch[1]);
    if (!product) return jsonResponse({ error: "product not found" }, 404);
    if (product.consignor_line_id) {
      try {
        await notifyConsignorRejection(env, product.consignor_line_id, product.name, reason);
      } catch (err) {
        return jsonResponse({ error: `LINE \u901A\u77E5\u5931\u6557\uFF0C\u672A\u99C1\u56DE\uFF1A${err.message}` }, 500);
      }
    }
    await rejectProduct(env, rejectMatch[1], reason);
    return jsonResponse(await getProductById(env, rejectMatch[1]));
  }
  const productMatch = path.match(/^\/products\/(\d+)$/);
  if (productMatch) {
    const id = productMatch[1];
    if (method === "GET") return jsonResponse(await getProductById(env, id));
    if (method === "PATCH") {
      const body = await request.json();
      return jsonResponse(await updateProduct(env, id, body));
    }
    if (method === "DELETE") {
      await removeProduct(env, id);
      return jsonResponse({ status: "deleted", id: parseInt(id) });
    }
  }
  if (path === "/transactions" && method === "GET") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    return jsonResponse(await listTransactions(env, { from, to }));
  }
  const assignMatch = path.match(/^\/transactions\/(\d+)\/assign-debtor$/);
  if (assignMatch && method === "POST") {
    const body = await request.json();
    const memberId = parseInt(body.member_id);
    if (!memberId) return jsonResponse({ error: "member_id required" }, 400);
    const tx = await getTransactionById(env, assignMatch[1]);
    if (!tx) return jsonResponse({ error: "transaction not found" }, 404);
    const member = await addDebtForTransaction(env, { memberId, txId: tx.id, amount: tx.total });
    if (!member) return jsonResponse({ error: "member not found" }, 404);
    await setTransactionIdentity(env, tx.id, member.nickname);
    return jsonResponse({ ok: true, transaction_id: tx.id, member: member.nickname, amount: tx.total });
  }
  if (path === "/members") {
    if (method === "GET") return jsonResponse(await listMembers(env));
  }
  const repayMatch = path.match(/^\/members\/(\d+)\/repay$/);
  if (repayMatch && method === "POST") {
    const body = await request.json();
    const amount = parseInt(body.amount);
    if (isNaN(amount) || amount <= 0) return jsonResponse({ error: "amount must be positive integer" }, 400);
    const newTotalDebt = await repayDebt(env, repayMatch[1], amount);
    if (newTotalDebt === null) return jsonResponse({ error: "member not found" }, 404);
    return jsonResponse({ member_id: parseInt(repayMatch[1]), total_debt: newTotalDebt });
  }
  if (path === "/announcements") {
    if (method === "GET") return jsonResponse(await listAnnouncements(env));
    if (method === "POST") {
      const body = await request.json();
      if (!body.description) return jsonResponse({ error: "description required" }, 400);
      await createAnnouncement(env, body);
      return jsonResponse({ status: "created" }, 201);
    }
  }
  if (path === "/stats/dashboard" && method === "GET") {
    return jsonResponse(await getDashboardStats(env));
  }
  return jsonResponse({ error: "not found", path, method }, 404);
}

// workerbackup/index.js
async function handleLineWebhook(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    console.error("[webhook] JSON \u89E3\u6790\u5931\u6557:", err?.message);
    return new Response("OK");
  }
  if (!body.events || body.events.length === 0) return new Response("OK");
  ctx.waitUntil(
    processEvent(env, body).catch((err) => {
      console.error("[webhook] processEvent \u672A\u6355\u6349\u4F8B\u5916:", err?.stack || err?.message || err);
    })
  );
  return new Response("OK");
}
async function processEvent(env, body) {
  const destination = body.destination;
  const channel = destination === env.LINE_CONSIGNOR_BOT_ID ? "consignor" : destination === env.LINE_MANAGER_BOT_ID ? "manager" : null;
  console.log(`[webhook] destination=${destination} channel=${channel} events=${body.events.length}`);
  if (!channel) {
    console.warn(`[webhook] \u672A\u77E5 destination\uFF08\u975E manager \u4E5F\u975E consignor bot\uFF09\uFF0C\u5FFD\u7565\u3002`);
    return;
  }
  const event = body.events[0];
  const userId = event.source?.userId;
  if (!userId) return;
  const defaultRole = channel === "consignor" ? "consignor" : "manager";
  const existingUser = await getByLineId(env, userId);
  const user = existingUser || await autoRegister(env, userId, defaultRole);
  console.log(`[webhook] userId=${userId} role=${user.role} last_command=${user.last_command} event.type=${event.type}`);
  if (channel === "manager") {
    return await handleManagerEvent(env, event, user, userId);
  } else if (channel === "consignor") {
    return await handleConsignorEvent(env, event, user, userId);
  }
}
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (url.pathname.startsWith("/api/admin")) {
      return handleAdminApi(request, env, url);
    }
    if (request.method === "GET" && url.pathname === "/api/products") {
      return jsonResponse(await listForPos(env));
    }
    if (request.method === "POST" && url.pathname === "/checkout") {
      return handleCheckout(request, env);
    }
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
export {
  index_default as default
};

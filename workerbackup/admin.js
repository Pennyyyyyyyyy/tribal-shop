// workerbackup/admin.js - 後台管理 API 與 POS 結帳模組

import {
  query,
  post,
  patch,
  remove,
  jsonResponse,
  listProducts,
  listAllProducts,
  listPendingProducts,
  getProductById,
  createProduct,
  updateProduct,
  removeProduct,
  approveProduct,
  rejectProduct,
  enqueueEmbeddingJob,
  listMembers,
  getMemberById,
  createTransaction,
  listTransactions,
  getTransactionById,
  setTransactionIdentity,
  addDebtForTransaction,
  repayDebt,
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  removeAnnouncement,
  getDashboardStats,
  adjustStock,
  listManagers
} from "./common.js";
import { notifyManagerOfCheckout } from "./manager.js";
import {
  getSalesInRange,
  listPayouts,
  notifyConsignorRejection,
  notifyConsignorPayout
} from "./consignor.js";

// ============================================================
// 1. JWT 與認證工具 (Auth)
// ============================================================
const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

export async function signJwt(payload, secret, ttlSeconds = 60 * 60 * 24) {
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

export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// ============================================================
// 2. POS 結帳處理 (Checkout)
// ============================================================
export async function handleCheckout(request, env) {
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

// ============================================================
// 3. 後台管理 API (Admin API)
// ============================================================
export async function handleAdminApi(request, env, url) {
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
  // 商品列表與新增
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

  // 商品審核通過
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

  // 商品駁回
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
        return jsonResponse({ error: `LINE 通知失敗，未駁回：${err.message}` }, 500);
      }
    }
    await rejectProduct(env, rejectMatch[1], reason);
    return jsonResponse(await getProductById(env, rejectMatch[1]));
  }

  // 個別商品操作 (GET, PATCH, DELETE)
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

  // 交易紀錄
  if (path === "/transactions" && method === "GET") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    return jsonResponse(await listTransactions(env, { from, to }));
  }

  // 指定賒帳族人
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

  // 族人名單
  if (path === "/members") {
    if (method === "GET") return jsonResponse(await listMembers(env));
  }

  // 族人還款
  const repayMatch = path.match(/^\/members\/(\d+)\/repay$/);
  if (repayMatch && method === "POST") {
    const body = await request.json();
    const amount = parseInt(body.amount);
    if (isNaN(amount) || amount <= 0) return jsonResponse({ error: "amount must be positive integer" }, 400);
    const newTotalDebt = await repayDebt(env, repayMatch[1], amount);
    if (newTotalDebt === null) return jsonResponse({ error: "member not found" }, 404);
    return jsonResponse({ member_id: parseInt(repayMatch[1]), total_debt: newTotalDebt });
  }

  // 布告欄公告
  if (path === "/announcements") {
    if (method === "GET") return jsonResponse(await listAnnouncements(env));
    if (method === "POST") {
      const body = await request.json();
      if (!body.description) return jsonResponse({ error: "description required" }, 400);
      await createAnnouncement(env, body);
      return jsonResponse({ status: "created" }, 201);
    }
  }

  // 營業統計儀表板
  if (path === "/stats/dashboard" && method === "GET") {
    return jsonResponse(await getDashboardStats(env));
  }

  return jsonResponse({ error: "not found", path, method }, 404);
}

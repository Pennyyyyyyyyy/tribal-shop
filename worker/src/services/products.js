// 商品業務邏輯。LINE bot 和未來 admin API 都要走這裡。
import * as supabase from "../lib/supabase.js";
import { taipeiToday } from "../lib/time.js";

// LINE picker 用（欄位精簡）。分類優先 → 名稱，同類商品自然聚在一起。
export async function list(env) {
    return supabase.query(env, "/rest/v1/products?select=id,name,stock,image_url,category&order=category,name");
}

// POS 顧客端用：只回上架商品，欄位精簡到顧客端需要的最小集合。
// Supabase 若因授權失敗回 error object，這裡強制退回 [] 避免 POS 拿到怪東西。
export async function listForPos(env) {
    const r = await supabase.query(
        env,
        "/rest/v1/products?is_active=eq.true&select=id,name,price,category,image_url&order=category,name",
    );
    return Array.isArray(r) ? r : [];
}

// Admin 用（含 price、category、trained、is_active 等全欄位）。
export async function listAll(env) {
    return supabase.query(env, "/rest/v1/products?select=*&order=category,name");
}

// 給結帳寫 transaction_items 用：撈這批商品當下的 consignor_line_id snapshot。
// 不信前端傳的值 —— 顧客那端不該知道也不該決定寄賣歸屬。
export async function getConsignorMap(env, ids) {
    if (!ids || !ids.length) return new Map();
    const rows = await supabase.query(env, `/rest/v1/products?id=in.(${ids.join(",")})&select=id,consignor_line_id`);
    return new Map((Array.isArray(rows) ? rows : []).map(p => [p.id, p.consignor_line_id]));
}

export async function getById(env, id) {
    const r = await supabase.query(env, `/rest/v1/products?id=eq.${id}`);
    return r[0] || null;
}

// 建立商品 + 同步建 training_data 佔位（LINE 補 4 張照片時要用）。
export async function create(env, { name, price, category, stock }) {
    const product = await supabase.postReturn(env, "/rest/v1/products", {
        name,
        price: parseInt(price),
        category,
        stock: parseInt(stock),
        trained: false,
    });
    await supabase.post(env, "/rest/v1/training_data", {
        product_id: product.id,
        english_name: "PENDING",
    });
    return product;
}

// 調整庫存 delta（結帳 = 負；補貨 = 正）。回傳更新後庫存，找不到商品回 null。
export async function adjustStock(env, id, delta) {
    const rows = await supabase.query(env, `/rest/v1/products?id=eq.${id}&select=stock`);
    if (!rows.length) return null;
    const newStock = (rows[0].stock || 0) + delta;
    await supabase.patch(env, `/rest/v1/products?id=eq.${id}`, { stock: newStock });
    return newStock;
}

// 補貨紀錄（stock 表）。日期用台灣時區的當日 YYYY-MM-DD，
// 避免台灣深夜補貨（UTC 凌晨）被記成隔天。
export async function recordRestock(env, productId, quantity) {
    return supabase.post(env, "/rest/v1/stock", {
        product_id: productId,
        quantity,
        restock_date: taipeiToday(),
    });
}

export async function setImageUrl(env, id, url) {
    return supabase.patch(env, `/rest/v1/products?id=eq.${id}`, { image_url: url });
}

// 找目前正在補訓練照片的商品（trained=false，最新一筆）。
export async function findLatestUntrained(env) {
    const r = await supabase.query(env, "/rest/v1/products?trained=eq.false&order=id.desc&limit=1");
    return r[0] || null;
}

// Admin 編輯商品：白名單欄位，避免打進不該改的欄（id / created_at 等）。
// consignor_line_id 是 nullable text；prev = null（自營）↔ 某族人 line_id（寄賣）。
const UPDATABLE_FIELDS = ["name", "price", "category", "stock", "image_url", "trained", "is_active", "consignor_line_id"];
const INT_FIELDS = new Set(["price", "stock"]);
const BOOL_FIELDS = new Set(["trained", "is_active"]);

export async function update(env, id, patch) {
    const clean = {};
    for (const key of UPDATABLE_FIELDS) {
        if (patch[key] === undefined) continue;
        if (INT_FIELDS.has(key)) clean[key] = parseInt(patch[key]);
        else if (BOOL_FIELDS.has(key)) clean[key] = Boolean(patch[key]);
        else clean[key] = patch[key];
    }
    if (Object.keys(clean).length === 0) return getById(env, id);
    await supabase.patch(env, `/rest/v1/products?id=eq.${id}`, clean);
    return getById(env, id);
}

export async function remove(env, id) {
    return supabase.remove(env, `/rest/v1/products?id=eq.${id}`);
}

// Dashboard 用：庫存低於門檻（含）的商品清單。
export async function findLowStock(env, threshold = 5) {
    return supabase.query(env, `/rest/v1/products?stock=lte.${threshold}&select=id,name,stock&order=stock`);
}

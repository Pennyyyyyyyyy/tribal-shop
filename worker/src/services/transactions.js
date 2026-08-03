// 結帳交易業務邏輯。POS 打 /checkout 走這裡；未來 admin API 也讀這裡。
import * as supabase from "../lib/supabase.js";
import * as products from "./products.js";
import { taipeiDayStart, taipeiDayEnd } from "../lib/time.js";

// 上傳結帳存證照片到 evidence bucket，回 public URL。
async function uploadEvidence(env, blob) {
    const path = `evidence_${Date.now()}.jpg`;
    return supabase.uploadPublic(env, "evidence", path, blob, "image/jpeg");
}

// 建立一筆交易。上傳照片 + 寫 transaction 表 + 拆 line items 到 transaction_items。
// 庫存扣減 / 通知 manager 是分離的 concern，留給 handler 或別的 service 呼叫。
//
// item_list JSON blob 現在跟 transaction_items 並存 —— 前者是歷史欄位，暫時保留避免斷開既有讀取；
// admin UI 全走 transaction_items 之後可以砍。
//
// consignor_line_id snapshot：從 products 查當下的值，不信前端傳的（顧客端不該決定寄賣歸屬）。
export async function create(env, { type, total, cart, photoBlob }) {
    const photoUrl = await uploadEvidence(env, photoBlob);
    const tx = await supabase.postReturn(env, "/rest/v1/transaction", {
        type,
        total: parseInt(total),
        item_list: JSON.stringify(cart),
        checkout_image: photoUrl,
        identity: type === "credit" ? "待確認族人" : "遊客",
    });

    if (Array.isArray(cart) && cart.length > 0) {
        const productIds = [...new Set(cart.map(it => it.id).filter(id => id != null))];
        const consignorMap = await products.getConsignorMap(env, productIds);
        const rows = cart.map(it => ({
            transaction_id: tx.id,
            product_id: it.id ?? null,
            quantity: it.quantity || 1,
            unit_price: it.price ?? 0,
            consignor_line_id: consignorMap.get(it.id) || null,
        }));
        await supabase.post(env, "/rest/v1/transaction_items", rows);
    }

    return { tx, photoUrl };
}

export async function getById(env, id) {
    const r = await supabase.query(env, `/rest/v1/transaction?id=eq.${id}`);
    return r[0] || null;
}

// Admin transactions 列表。from/to 是「YYYY-MM-DD」，代表台灣時區當天。
// 例：from=2026-07-19 to=2026-07-19 → 抓台灣 7/19 00:00~23:59 之間的交易。
export async function list(env, { from, to } = {}) {
    let path = "/rest/v1/transaction?select=*&order=created_at.desc";
    if (from) path += `&created_at=gte.${encodeURIComponent(taipeiDayStart(from))}`;
    if (to) path += `&created_at=lte.${encodeURIComponent(taipeiDayEnd(to))}`;
    return supabase.query(env, path);
}

// Dashboard 用：某日的交易列表（只選 total）。
export async function listSince(env, isoDate) {
    return supabase.query(env, `/rest/v1/transaction?created_at=gte.${encodeURIComponent(isoDate)}&select=total`);
}

// 賒帳確認後把 identity 從「待確認族人」改成實際族人名。
export async function setIdentity(env, id, identity) {
    return supabase.patch(env, `/rest/v1/transaction?id=eq.${id}`, { identity });
}

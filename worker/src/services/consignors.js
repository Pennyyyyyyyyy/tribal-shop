// 寄賣族人業務邏輯。
// 寄賣者 = users.role='consignor' 的一列；他們擁有 products.consignor_line_id 指向自己的商品，
// 銷售額由 transaction_items.consignor_line_id (snapshot) 追蹤，分潤靠 payouts 表結算。
import * as supabase from "../lib/supabase.js";
import { taipeiDayStart, taipeiDayEnd } from "../lib/time.js";

// 三個 query 一次撈、JS 端 aggregate。
// 沒用 PostgREST embedded select，因為本 repo 尚無前例；沿用大家熟悉的分開查再合的 pattern。
// unpaid_gross 定義：total_gross 扣掉「已付」payouts 的 gross_amount；pending 的先不算，因為 draft 可能被砍。
export async function list(env) {
    const [users, items, paidPayouts] = await Promise.all([
        supabase.query(env, "/rest/v1/users?role=eq.consignor&select=line_id,nickname&order=nickname"),
        supabase.query(env, "/rest/v1/transaction_items?consignor_line_id=not.is.null&select=consignor_line_id,quantity,unit_price"),
        supabase.query(env, "/rest/v1/payouts?status=eq.paid&select=consignor_line_id,gross_amount"),
    ]);

    const usersArr = Array.isArray(users) ? users : [];
    const itemsArr = Array.isArray(items) ? items : [];
    const paidArr = Array.isArray(paidPayouts) ? paidPayouts : [];

    const grossMap = new Map();
    for (const it of itemsArr) {
        const key = it.consignor_line_id;
        const add = (it.quantity || 0) * (it.unit_price || 0);
        grossMap.set(key, (grossMap.get(key) || 0) + add);
    }

    const paidMap = new Map();
    for (const p of paidArr) {
        const key = p.consignor_line_id;
        paidMap.set(key, (paidMap.get(key) || 0) + (p.gross_amount || 0));
    }

    return usersArr.map(u => {
        const total_gross = grossMap.get(u.line_id) || 0;
        const paid = paidMap.get(u.line_id) || 0;
        return {
            line_id: u.line_id,
            nickname: u.nickname,
            total_gross,
            unpaid_gross: total_gross - paid,
        };
    });
}

// line_id 是 text 主鍵，可能含破 URL 的字元 → 一律 encodeURIComponent。
export async function getByLineId(env, lineId) {
    const r = await supabase.query(env, `/rest/v1/users?line_id=eq.${encodeURIComponent(lineId)}&select=*`);
    return r[0] || null;
}

// 指定族人 + 日期範圍的銷售明細。from/to 是「YYYY-MM-DD」台灣日期。
// 三段查：先撈範圍內的 transaction id → 再撈該族人的 items → 補上商品名（含 orphan 標示）。
// 不用 PostgREST embed；三個 in.() 查詢在小規模資料下夠用，也對得起現有 code style。
export async function getSalesInRange(env, lineId, from, to) {
    const startISO = encodeURIComponent(taipeiDayStart(from));
    const endISO = encodeURIComponent(taipeiDayEnd(to));
    const txs = await supabase.query(
        env,
        `/rest/v1/transaction?created_at=gte.${startISO}&created_at=lte.${endISO}&select=id,created_at,identity,type&order=created_at.desc`,
    );
    const txArr = Array.isArray(txs) ? txs : [];
    if (txArr.length === 0) return [];

    const txMap = new Map(txArr.map(t => [t.id, t]));
    const txIds = txArr.map(t => t.id).join(",");

    const items = await supabase.query(
        env,
        `/rest/v1/transaction_items?consignor_line_id=eq.${encodeURIComponent(lineId)}&transaction_id=in.(${txIds})&select=id,transaction_id,product_id,quantity,unit_price`,
    );
    const itemsArr = Array.isArray(items) ? items : [];
    if (itemsArr.length === 0) return [];

    // 商品名 lookup：orphan product_id（已被店長刪掉）依 D2-A 顯示「(已刪除商品 #<id>)」。
    const productIds = [...new Set(itemsArr.map(i => i.product_id).filter(id => id != null))];
    const nameMap = new Map();
    if (productIds.length > 0) {
        const products = await supabase.query(
            env,
            `/rest/v1/products?id=in.(${productIds.join(",")})&select=id,name`,
        );
        for (const p of (Array.isArray(products) ? products : [])) {
            nameMap.set(p.id, p.name);
        }
    }

    // 依 txArr 的順序（已 created_at desc）走一次，同 tx 內的 items 保持 DB 回傳順序。
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
                transaction_identity: tx.identity,
            });
        }
    }
    return out;
}

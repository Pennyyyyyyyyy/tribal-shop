// 分潤結算業務邏輯。Admin API 和未來 cron 都走這裡。
import * as supabase from "../lib/supabase.js";
import { taipeiDayStart, taipeiDayEnd } from "../lib/time.js";

// 族人分潤比例。0.7 = 族人拿 70%、店家抽 30%。
// 命名承襲原設計，注意：這是「族人拿的比例」，不是「店家抽的比例」。
// 四捨五入 net_payout；commission = gross - net（用減法保證兩邊加起來 = gross，避免各自 round 產生 $1 誤差）。
export const COMMISSION_RATE = 0.7;

// 從 gross 算出 net / commission 三個數字。純函數，方便單獨測試。
export function computeAmounts(gross) {
    const net = Math.round(gross * COMMISSION_RATE);
    const commission = gross - net;
    return { gross, commission, net };
}

// 期間試算（不寫入 DB）。
// 用途：admin 產生 payout 前的 preview、標記已付時組 LINE 通知內文。
// from / to 是 YYYY-MM-DD（台灣時區當日）。
// 走多次查詢 + JS 聚合；不用 PostgREST embed 保守起見。
export async function computePeriod(env, { lineId, from, to }) {
    // 1. 取寄賣者資料（要 nickname）
    const userRows = await supabase.query(
        env,
        `/rest/v1/users?line_id=eq.${encodeURIComponent(lineId)}&select=line_id,nickname`,
    );
    const consignor = userRows[0] || { line_id: lineId, nickname: null };

    // 2. 期間內所有 transaction 的 id
    const startISO = encodeURIComponent(taipeiDayStart(from));
    const endISO = encodeURIComponent(taipeiDayEnd(to));
    const txRows = await supabase.query(
        env,
        `/rest/v1/transaction?created_at=gte.${startISO}&created_at=lte.${endISO}&select=id`,
    );

    // 期間內沒交易 → 直接回零，省下後面的查詢。
    if (!txRows.length) {
        return {
            consignor: { line_id: consignor.line_id, nickname: consignor.nickname },
            period_start: from,
            period_end: to,
            gross_amount: 0,
            commission_amount: 0,
            net_payout: 0,
            items: [],
        };
    }

    const txIds = txRows.map(t => t.id);

    // 3. 該寄賣者在這批交易中的 line items
    const items = await supabase.query(
        env,
        `/rest/v1/transaction_items?consignor_line_id=eq.${encodeURIComponent(lineId)}&transaction_id=in.(${txIds.join(",")})&select=product_id,quantity,unit_price`,
    );

    if (!items.length) {
        return {
            consignor: { line_id: consignor.line_id, nickname: consignor.nickname },
            period_start: from,
            period_end: to,
            gross_amount: 0,
            commission_amount: 0,
            net_payout: 0,
            items: [],
        };
    }

    // 4. 依 product_id 聚合。unit_price 假設期間內沒變；若真的變了取最後一筆看到的值。
    const agg = new Map();
    for (const it of items) {
        const key = it.product_id;
        const prev = agg.get(key) || { product_id: key, quantity: 0, subtotal: 0, unit_price: it.unit_price };
        prev.quantity += it.quantity;
        prev.subtotal += it.quantity * it.unit_price;
        prev.unit_price = it.unit_price;
        agg.set(key, prev);
    }

    // 5. 補商品名。查不到 → 標記為 (已刪除商品 #<id>)（保留 id 供追溯，D2-A）
    const productIds = [...agg.keys()];
    const products = await supabase.query(
        env,
        `/rest/v1/products?id=in.(${productIds.join(",")})&select=id,name`,
    );
    const nameById = new Map(products.map(p => [p.id, p.name]));

    const detailed = productIds.map(pid => {
        const row = agg.get(pid);
        return {
            product_id: pid,
            product_name: nameById.get(pid) || `(已刪除商品 #${pid})`,
            quantity: row.quantity,
            unit_price: row.unit_price,
            subtotal: row.subtotal,
        };
    }).sort((a, b) => b.subtotal - a.subtotal);

    const gross = detailed.reduce((s, x) => s + x.subtotal, 0);
    const { commission, net } = computeAmounts(gross);

    return {
        consignor: { line_id: consignor.line_id, nickname: consignor.nickname },
        period_start: from,
        period_end: to,
        gross_amount: gross,
        commission_amount: commission,
        net_payout: net,
        items: detailed,
    };
}

// 建立一筆結算（status=pending）。
// 依 D1-C 決策：只擋跟「已付」結算重疊的期間；跟 pending 重疊不擋（可以刪重建）。
export async function create(env, { lineId, from, to }) {
    const paidPayouts = await supabase.query(
        env,
        `/rest/v1/payouts?consignor_line_id=eq.${encodeURIComponent(lineId)}&status=eq.paid&select=id,period_start,period_end`,
    );
    for (const p of paidPayouts) {
        // 兩個區間不重疊 ⇔ 一個完全在另一個之前。取反即為重疊。
        const noOverlap = p.period_end < from || p.period_start > to;
        if (!noOverlap) {
            throw new Error(`該期間與已付結算 #${p.id} (${p.period_start}~${p.period_end}) 重疊，請調整日期`);
        }
    }

    const summary = await computePeriod(env, { lineId, from, to });
    return supabase.postReturn(env, "/rest/v1/payouts", {
        consignor_line_id: lineId,
        period_start: from,
        period_end: to,
        gross_amount: summary.gross_amount,
        commission_amount: summary.commission_amount,
        net_payout: summary.net_payout,
        status: "pending",
    });
}

// 標記已付。回傳更新後 row，方便 caller 拿來組 LINE 通知。
export async function markPaid(env, payoutId) {
    await supabase.patch(env, `/rest/v1/payouts?id=eq.${payoutId}`, {
        status: "paid",
        paid_at: new Date().toISOString(),
    });
    return getById(env, payoutId);
}

export async function getById(env, id) {
    const r = await supabase.query(env, `/rest/v1/payouts?id=eq.${id}`);
    return r[0] || null;
}

// 列表；預設 period_start 由新到舊。
export async function list(env, { lineId, status } = {}) {
    let path = "/rest/v1/payouts?select=*&order=period_start.desc";
    if (lineId) path += `&consignor_line_id=eq.${encodeURIComponent(lineId)}`;
    if (status) path += `&status=eq.${encodeURIComponent(status)}`;
    return supabase.query(env, path);
}

// 只允許刪 pending —— 已付結算屬於歷史帳，絕不從 DB 抹除。
export async function remove(env, id) {
    const existing = await getById(env, id);
    if (!existing) throw new Error("payout not found");
    if (existing.status === "paid") throw new Error("已付結算不可刪除");
    return supabase.remove(env, `/rest/v1/payouts?id=eq.${id}`);
}

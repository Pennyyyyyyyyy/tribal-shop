// Admin dashboard 聚合資料。橫跨多個 domain，故單獨開檔。
import * as transactions from "./transactions.js";
import * as members from "./members.js";
import * as products from "./products.js";
import { taipeiToday, taipeiDayStart } from "../lib/time.js";

// 「今天」= 台灣時區的今天，不是 UTC 今天。
// UTC 落後 8 小時，若用 UTC「今天」，凌晨 0-8 點會抓到「昨天到現在」的資料。
export async function dashboard(env, { lowStockThreshold = 5 } = {}) {
    const todayStart = taipeiDayStart(taipeiToday());   // 例：2026-07-19T00:00:00+08:00

    const [todayTx, outstandingDebt, lowStock] = await Promise.all([
        transactions.listSince(env, todayStart),
        members.totalOutstandingDebt(env),
        products.findLowStock(env, lowStockThreshold),
    ]);

    return {
        today_revenue: todayTx.reduce((s, t) => s + (t.total || 0), 0),
        today_transaction_count: todayTx.length,
        outstanding_debt: outstandingDebt,
        low_stock: lowStock,
    };
}

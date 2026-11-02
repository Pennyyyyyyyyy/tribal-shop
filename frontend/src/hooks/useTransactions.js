// 交易列表資料：期間查詢 + 小計（電腦版與手機版共用）
import { useEffect, useMemo, useState } from "react";
import * as api from "../service/adminApi";
import { PENDING_DEBTOR, taipeiDate } from "../utils/adminFormat";

export function useTransactions() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // 預設：最近一個月（30 天）
    const [from, setFrom] = useState(() => taipeiDate(-30));
    const [to, setTo] = useState(() => taipeiDate(0));

    // 可傳 fromArg / toArg 覆蓋 state（給快捷區間 button 用，避開 React
    // setState 非同步讀到舊 closure state 導致要按兩次才對的 bug）。
    async function load(fromArg, toArg) {
        // 只吃 string；防止 <button onClick={load}> 把 SyntheticEvent 當日期傳進來的坑。
        const f = typeof fromArg === "string" ? fromArg : from;
        const t = typeof toArg === "string" ? toArg : to;
        setLoading(true);
        try {
            const data = await api.transactions.list({ from: f || undefined, to: t || undefined });
            // 防禦：若 API 回非陣列（例如 supabase 錯誤物件），強制退回 [] 避免下方 useMemo 崩。
            setItems(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    // 小計：現金 + 賒帳分開，配上總筆數
    const totals = useMemo(() => {
        let cash = 0, credit = 0, pending = 0;
        for (const tx of items) {
            const t = tx.total || 0;
            if (tx.type === "credit") {
                credit += t;
                if (tx.identity === PENDING_DEBTOR) pending += 1;
            } else {
                cash += t;
            }
        }
        return { cash, credit, pending, total: cash + credit, count: items.length };
    }, [items]);

    function setQuickRange(days) {
        const nf = taipeiDate(-days);
        const nt = taipeiDate(0);
        setFrom(nf);
        setTo(nt);
        load(nf, nt);   // 直接用新值查，不等 React re-render
    }

    return { items, loading, error, from, setFrom, to, setTo, load, totals, setQuickRange };
}

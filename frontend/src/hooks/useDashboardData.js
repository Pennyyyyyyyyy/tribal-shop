// 總覽頁資料：統計 + 賒帳居民 + 低庫存（電腦版與手機版共用）
import { useCallback, useEffect, useState } from "react";
import * as api from "../service/adminApi";

// 庫存 ≤ 這個數字才列入「低庫存」。Worker 回傳的是 ≤ 5，這裡再篩一次
export const LOW_STOCK_THRESHOLD = 3;

export function useDashboardData() {
    const [data, setData] = useState(null);
    const [members, setMembers] = useState([]);
    const [images, setImages] = useState({});   // product id → image_url
    const [error, setError] = useState(null);
    const [version, setVersion] = useState(0);  // 改完庫存後 +1 重新抓

    useEffect(() => {
        let alive = true;
        // stats 的 low_stock 只帶 id/name/stock，圖片從商品列表補；拿不到就顯示佔位，不擋總覽
        Promise.all([
            api.stats.dashboard(),
            api.members.list(),
            api.products.list().catch(() => []),
        ])
            .then(([d, m, products]) => {
                if (!alive) return;
                setData(d);
                setMembers(m);
                setImages(Object.fromEntries(products.map(p => [p.id, p.image_url])));
            })
            .catch(err => alive && setError(err.message));
        return () => { alive = false; };
    }, [version]);

    const reload = useCallback(() => setVersion(v => v + 1), []);

    const debtors = members
        .filter(m => (m.total_debt || 0) > 0)
        .sort((a, b) => (b.total_debt || 0) - (a.total_debt || 0));
    const lowStock = (data?.low_stock || [])
        .filter(p => p.stock <= LOW_STOCK_THRESHOLD)
        .map(p => ({ ...p, image_url: p.image_url || images[p.id] }));

    return { data, debtors, lowStock, error, reload };
}

// 總覽頁資料：統計 + 賒帳族人 + 低庫存（電腦版與手機版共用）
import { useEffect, useState } from "react";
import * as api from "../service/adminApi";

export function useDashboardData() {
    const [data, setData] = useState(null);
    const [members, setMembers] = useState([]);
    const [images, setImages] = useState({});   // product id → image_url
    const [error, setError] = useState(null);

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
    }, []);

    const debtors = members
        .filter(m => (m.total_debt || 0) > 0)
        .sort((a, b) => (b.total_debt || 0) - (a.total_debt || 0));
    const lowStock = (data?.low_stock || []).map(p => ({ ...p, image_url: p.image_url || images[p.id] }));

    return { data, debtors, lowStock, error };
}

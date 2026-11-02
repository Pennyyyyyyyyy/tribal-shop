// 商品列表資料 + 樂觀切換上架（店內商品 / 寄賣商品，電腦版與手機版共用）
// consignment=false → 只留店內商品；true → 只留寄賣商品
import { useEffect, useState } from "react";
import * as api from "../service/adminApi";

export function useAdminProducts({ consignment }) {
    const [items, setItems] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        try {
            const all = await api.products.list();
            setItems(all.filter(p => !!p.consignor_line_id === consignment));
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, []);

    // 樂觀切換上架——先改 UI、後打 API；失敗回滾並顯示錯誤。
    async function toggleActive(product) {
        const prev = items;
        const newVal = !product.is_active;
        setItems(items.map(p => p.id === product.id ? { ...p, is_active: newVal } : p));
        try {
            await api.products.update(product.id, { is_active: newVal });
        } catch (err) {
            setItems(prev);
            setError(err.message);
        }
    }

    return { items, error, setError, loading, load, toggleActive };
}

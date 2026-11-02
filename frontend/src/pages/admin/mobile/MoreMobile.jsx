import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "../../../service/adminApi";
import { useAdminAuth } from "../../../hooks/useAdminAuth";

export default function MoreMobile() {
    const { logout } = useAdminAuth();
    const navigate = useNavigate();
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        // 待審核的寄賣商品數，顯示在選單右側；拿不到就不顯示
        api.products.listPending()
            .then(list => setPendingCount(Array.isArray(list) ? list.length : 0))
            .catch(() => { });
    }, []);

    function onLogout() {
        logout();
        navigate("/admin/login", { replace: true });
    }

    return (
        <div className="flex flex-col gap-3.5">
            <h1 className="font-display text-[30px] leading-tight">更多</h1>

            <MenuItem to="/admin/consignment-products" title="寄賣商品" desc="族人透過 LINE 上架的商品" badge={pendingCount}>
                <path d="M3 9l2-5h14l2 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" />
            </MenuItem>
            <MenuItem to="/admin/payouts" title="分潤結算" desc="寄賣者分潤與歷史結算">
                <rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" />
            </MenuItem>
            <MenuItem to="/admin/announcements" title="公告管理" desc="發布平板跑馬燈公告">
                <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M15 9a4 4 0 0 1 0 6" /><path d="M18 6a8 8 0 0 1 0 12" />
            </MenuItem>

            <button onClick={onLogout} className="btn-press mt-2.5 h-[52px] gap-2 rounded-2xl shadow-press-sm bg-sand text-ink text-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" />
                </svg>
                登出
            </button>
        </div>
    );
}

function MenuItem({ to, title, desc, badge = 0, children }) {
    return (
        <Link to={to} className="focus-ring bg-paper border-2 border-ink rounded-[18px] p-3.5 min-h-16 flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-[14px] bg-cream text-forest flex items-center justify-center shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {children}
                </svg>
            </span>
            <span className="flex-1 min-w-0">
                <span className="block font-bold text-[17px]">{title}</span>
                <span className="block text-[13px]">{desc}</span>
            </span>
            {badge > 0 && (
                <span className="min-w-[26px] h-[26px] px-1.5 rounded-full bg-clay text-paper text-sm font-bold flex items-center justify-center" aria-label={`${badge} 項待審核`}>
                    {badge}
                </span>
            )}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
            </svg>
        </Link>
    );
}

import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../hooks/useAdminAuth";
import BrandMark from "../BrandMark";

const NAV = [
    { to: "/admin", label: "總覽", end: true },
    { to: "/admin/products", label: "商品" },
    { to: "/admin/consignment-products", label: "寄賣商品" },
    { to: "/admin/transactions", label: "交易" },
    { to: "/admin/members", label: "族人" },
    { to: "/admin/payouts", label: "分潤" },
    { to: "/admin/announcements", label: "公告" },
];

export default function AdminLayout() {
    const { logout } = useAdminAuth();
    const navigate = useNavigate();

    function onLogout() {
        logout();
        navigate("/admin/login", { replace: true });
    }

    return (
        <div className="h-screen flex flex-col bg-cream text-ink overflow-hidden">
            {/* Header — 與 POS 同一條森林綠頂欄 */}
            <header className="bg-forest text-paper px-8 py-4 flex items-center gap-3.5 shrink-0">
                <BrandMark tone="light" size="sm" subtitle={null} />
                <div className="text-[15px] opacity-85 pl-3 border-l-2 border-paper/30">店長後台</div>
                <button
                    onClick={onLogout}
                    className="focus-ring ml-auto font-bold text-[15px] px-4 py-2.5 rounded-xl bg-paper/15 hover:bg-paper/25 transition-colors"
                >
                    登出
                </button>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto">
                <nav className="max-w-[1280px] mx-auto px-8 pt-6 flex gap-2.5 flex-wrap" aria-label="後台選單">
                    {NAV.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) => `focus-ring tab ${isActive ? "tab-on" : "hover:border-clay"}`}
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <main className="max-w-[1280px] mx-auto px-8 pt-7 pb-12">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

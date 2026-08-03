import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../hooks/useAdminAuth";

const NAV = [
    { to: "/admin", label: "總覽", end: true },
    { to: "/admin/products", label: "商品" },
    { to: "/admin/transactions", label: "交易" },
    { to: "/admin/members", label: "族人" },
    { to: "/admin/consignors", label: "寄賣" },
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
        <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
            {/* Header — 綠底延續 POS 品牌，但收窄字級 */}
            <header className="bg-green-700 text-white px-6 py-3 shadow-md">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-base font-semibold tracking-wide">飛鼠商店 · 店長後台</div>
                        <div className="text-[11px] text-green-100 tracking-wider uppercase mt-0.5">
                            Flying Squirrel Shop · Admin
                        </div>
                    </div>
                    <button
                        onClick={onLogout}
                        className="text-xs bg-green-900/40 hover:bg-green-900/60 px-3 py-1.5 rounded-full transition-colors"
                    >
                        登出
                    </button>
                </div>
            </header>

            {/* Main：sidebar 左、內容右，包在中央 rounded 卡片內 */}
            <main className="flex-1 flex justify-center px-4 py-4 min-h-0 overflow-hidden">
                <div className="w-full max-w-6xl bg-slate-50 rounded-3xl shadow-2xl border border-slate-200 flex overflow-hidden">
                    <nav className="w-44 shrink-0 border-r border-slate-200 bg-white/40 py-6 px-3">
                        {NAV.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                className={({ isActive }) =>
                                    [
                                        "block px-3 py-2 rounded-xl text-sm mb-1 transition-colors",
                                        isActive
                                            ? "bg-green-600 text-white font-semibold shadow-sm"
                                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                                    ].join(" ")
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="flex-1 min-w-0 overflow-y-auto px-8 py-8">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}

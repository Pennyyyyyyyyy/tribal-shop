// 手機版後台外框：森林綠頂欄 + 可捲動內容 + 底部 5 格導覽。
// 「更多」底下的頁面（寄賣 / 分潤 / 公告）頂欄改成「‹ 更多」返回鍵。
import React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

const MORE_PATHS = ["/admin/more", "/admin/consignment-products", "/admin/payouts", "/admin/announcements"];

const NAV = [
    { to: "/admin", label: "總覽", end: true, icon: IconGrid },
    { to: "/admin/products", label: "商品", icon: IconBox },
    { to: "/admin/transactions", label: "交易", icon: IconReceipt },
    { to: "/admin/members", label: "族人", icon: IconPeople },
    { to: "/admin/more", label: "更多", icon: IconDots, matchMore: true },
];

const TAB_CLASS = "focus-ring flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[60px] rounded-xl text-xs font-bold";

export default function MobileAdminLayout() {
    const { pathname } = useLocation();
    const inMore = MORE_PATHS.includes(pathname);
    const isSubPage = inMore && pathname !== "/admin/more";

    return (
        <div className="h-[100dvh] flex flex-col bg-cream text-ink overflow-hidden">
            <header className="bg-forest text-paper px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 min-h-[60px] flex items-center gap-2.5 shrink-0">
                {isSubPage ? (
                    <>
                        <Link
                            to="/admin/more"
                            aria-label="返回更多選單"
                            className="focus-ring rounded-lg flex items-center min-h-[44px] gap-0.5 pr-3 font-bold"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                            更多
                        </Link>
                        <div className="ml-auto font-display text-lg">Go-Remote</div>
                    </>
                ) : (
                    <>
                        <div className="w-9 h-9 rounded-full border-2 border-dashed border-paper/60 flex items-center justify-center text-[9px] shrink-0" aria-hidden="true">LOGO</div>
                        <div className="font-display text-xl leading-tight">Go-Remote</div>
                        <div className="text-[13px] opacity-90 pl-2.5 border-l-2 border-paper/30">店長後台</div>
                    </>
                )}
            </header>

            <main className="flex-1 min-h-0 overflow-y-auto px-4 pt-[18px] pb-6">
                <Outlet />
            </main>

            <nav
                aria-label="後台選單"
                className="flex bg-paper border-t-[3px] border-ink px-1 pt-1 pb-[max(6px,env(safe-area-inset-bottom))] shrink-0"
            >
                {NAV.map(({ to, label, end, icon, matchMore }) => {
                    const Icon = icon;
                    const content = (on) => (
                        <>
                            <span className={`w-12 h-[30px] rounded-full flex items-center justify-center ${on ? "bg-forest text-paper" : ""}`}>
                                <Icon />
                            </span>
                            {label}
                        </>
                    );
                    // 「更多」在子頁（寄賣 / 分潤 / 公告）也要亮，NavLink 判斷不到，改用 Link 自己算
                    return matchMore ? (
                        <Link key={to} to={to} aria-current={inMore ? "page" : undefined} className={TAB_CLASS}>
                            {content(inMore)}
                        </Link>
                    ) : (
                        <NavLink key={to} to={to} end={end} className={TAB_CLASS}>
                            {({ isActive }) => content(isActive)}
                        </NavLink>
                    );
                })}
            </nav>
        </div>
    );
}

function Svg({ children }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {children}
        </svg>
    );
}
function IconGrid() {
    return <Svg><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>;
}
function IconBox() {
    return <Svg><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></Svg>;
}
function IconReceipt() {
    return <Svg><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></Svg>;
}
function IconPeople() {
    return <Svg><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M17.5 14.5a5 5 0 0 1 4 5.5" /></Svg>;
}
function IconDots() {
    return <Svg><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></Svg>;
}

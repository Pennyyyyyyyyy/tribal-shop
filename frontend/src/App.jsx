import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CheckoutProvider } from "./context/CheckoutContext";
import { AnnouncementProvider } from "./context/AnnouncementContext";
import Layout from "./components/Layout";
import WelcomePage from "./pages/WelcomePage";
import AuthPage from "./pages/AuthPage";
import InstructionPage from "./pages/InstructionPage";
import ScanPage from "./pages/ScanPage";
import CartPage from "./pages/CartPage";
import PaymentPage from "./pages/PaymentPage";
import EvidencePage from "./pages/EvidencePage";
import CompletePage from "./pages/CompletePage";
import ProductSelectPage from "./pages/ProductSelectPage";

// Admin (Step 4) — 不進 POS 的 CheckoutProvider，走獨立 Layout
import AdminLayout from "./components/admin/AdminLayout";
import RequireAuth from "./components/admin/RequireAuth";
import AdminLoginPage from "./pages/admin/LoginPage";
import AdminDashboardPage from "./pages/admin/DashboardPage";
import AdminProductsPage from "./pages/admin/ProductsPage";
import AdminTransactionsPage from "./pages/admin/TransactionsPage";
import AdminMembersPage from "./pages/admin/MembersPage";
import AdminConsignmentProductsPage from "./pages/admin/ConsignmentProductsPage";
import AdminPayoutsPage from "./pages/admin/PayoutsPage";
import AdminAnnouncementsPage from "./pages/admin/AnnouncementsPage";

// 手機版後台：同一組網址，螢幕窄於 768px 時改用 mobile/ 底下的畫面
import { useIsMobile } from "./hooks/useIsMobile";
import MobileAdminLayout from "./components/admin/mobile/MobileAdminLayout";
import DashboardMobile from "./pages/admin/mobile/DashboardMobile";
import ProductsMobile from "./pages/admin/mobile/ProductsMobile";
import ConsignmentMobile from "./pages/admin/mobile/ConsignmentMobile";
import TransactionsMobile from "./pages/admin/mobile/TransactionsMobile";
import MembersMobile from "./pages/admin/mobile/MembersMobile";
import PayoutsMobile from "./pages/admin/mobile/PayoutsMobile";
import AnnouncementsMobile from "./pages/admin/mobile/AnnouncementsMobile";
import MoreMobile from "./pages/admin/mobile/MoreMobile";

// VITE_APP_MODE=admin：只打包店長後台（給 Cloudflare Pages 用），POS 頁面整段不進 bundle
const ADMIN_ONLY = import.meta.env.VITE_APP_MODE === "admin";

// 依螢幕寬度選電腦版或手機版
function Responsive({ desktop, mobile }) {
  const Page = useIsMobile() ? mobile : desktop;
  return <Page />;
}

// 「更多」只有手機版有；電腦版打開就回總覽
function MoreRoute() {
  return useIsMobile() ? <MoreMobile /> : <Navigate to="/admin" replace />;
}

function App() {
  return (
    <Routes>
      {/* Admin 後台（獨立於 POS 上下文）*/}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <Responsive desktop={AdminLayout} mobile={MobileAdminLayout} />
          </RequireAuth>
        }
      >
        <Route index element={<Responsive desktop={AdminDashboardPage} mobile={DashboardMobile} />} />
        <Route path="products" element={<Responsive desktop={AdminProductsPage} mobile={ProductsMobile} />} />
        <Route path="consignment-products" element={<Responsive desktop={AdminConsignmentProductsPage} mobile={ConsignmentMobile} />} />
        <Route path="transactions" element={<Responsive desktop={AdminTransactionsPage} mobile={TransactionsMobile} />} />
        <Route path="members" element={<Responsive desktop={AdminMembersPage} mobile={MembersMobile} />} />
        <Route path="payouts" element={<Responsive desktop={AdminPayoutsPage} mobile={PayoutsMobile} />} />
        <Route path="announcements" element={<Responsive desktop={AdminAnnouncementsPage} mobile={AnnouncementsMobile} />} />
        <Route path="more" element={<MoreRoute />} />
      </Route>

      {/* POS 自助結帳流程 */}
      {ADMIN_ONLY ? (
        <Route path="*" element={<Navigate to="/admin" replace />} />
      ) : (
        <Route
          element={
            <CheckoutProvider>
              <AnnouncementProvider>
                <Layout />
              </AnnouncementProvider>
            </CheckoutProvider>
          }
        >
          <Route path="/" element={<WelcomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/instruction" element={<InstructionPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/products" element={<ProductSelectPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/evidence" element={<EvidencePage />} />
          <Route path="/complete" element={<CompletePage />} />
        </Route>
      )}
    </Routes>
  );
}

export default App;

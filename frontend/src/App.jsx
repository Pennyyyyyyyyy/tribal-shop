import React from "react";
import { Routes, Route } from "react-router-dom";
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

function App() {
  return (
    <Routes>
      {/* Admin 後台（獨立於 POS 上下文）*/}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="consignment-products" element={<AdminConsignmentProductsPage />} />
        <Route path="transactions" element={<AdminTransactionsPage />} />
        <Route path="members" element={<AdminMembersPage />} />
        <Route path="payouts" element={<AdminPayoutsPage />} />
        <Route path="announcements" element={<AdminAnnouncementsPage />} />
      </Route>

      {/* POS 自助結帳流程 */}
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
    </Routes>
  );
}

export default App;

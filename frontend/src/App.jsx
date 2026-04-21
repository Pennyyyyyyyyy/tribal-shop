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

function App() {
  return (
    <CheckoutProvider>
      <AnnouncementProvider>
        <Routes>
          <Route element={<Layout />}>
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
      </AnnouncementProvider>
    </CheckoutProvider>
  );
}

export default App;

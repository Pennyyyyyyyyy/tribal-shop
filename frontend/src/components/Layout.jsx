import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import { useCheckout } from "../context/CheckoutContext";

// 遊客：Welcome(1) → Instruction(2) → Scan/Products(3) → Cart(4) → Evidence(5) → Payment(6)
const GUEST_STEP_MAP = {
  "/": 1,
  "/instruction": 2,
  "/scan": 3,
  "/products": 3,
  "/cart": 4,
  "/evidence": 5,
  "/payment": 6,
};
const GUEST_TOTAL = 6;

// 族人：Welcome(1) → Auth(2) → Instruction(3) → Scan/Products(4) → Cart(5) → Evidence(6)
const TRIBAL_STEP_MAP = {
  "/": 1,
  "/auth": 2,
  "/instruction": 3,
  "/scan": 4,
  "/products": 4,
  "/cart": 5,
  "/evidence": 6,
};
const TRIBAL_TOTAL = 6;

export default function Layout() {
  const location = useLocation();
  const { cartCount, totalAmount, isTribalMember } = useCheckout();

  const stepMap = isTribalMember ? TRIBAL_STEP_MAP : GUEST_STEP_MAP;
  const totalSteps = isTribalMember ? TRIBAL_TOTAL : GUEST_TOTAL;
  const currentStep = stepMap[location.pathname] || 1;

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      <Header
        currentStep={currentStep}
        totalSteps={totalSteps}
        cartCount={cartCount}
        totalAmount={totalAmount}
      />
      <main className="flex-1 flex justify-center px-4 py-6 min-h-0">
        <div className="w-full max-w-6xl bg-slate-50 rounded-3xl shadow-2xl border border-slate-200 p-6 md:p-8 flex flex-col min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

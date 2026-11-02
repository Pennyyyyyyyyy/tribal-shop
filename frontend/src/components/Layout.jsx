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

// 歡迎頁與完成頁是滿版插畫，不顯示頂欄
const FULL_BLEED_PATHS = new Set(["/", "/complete"]);

export default function Layout() {
  const location = useLocation();
  const { isTribalMember } = useCheckout();

  const stepMap = isTribalMember ? TRIBAL_STEP_MAP : GUEST_STEP_MAP;
  const totalSteps = isTribalMember ? TRIBAL_TOTAL : GUEST_TOTAL;
  const currentStep = stepMap[location.pathname] || 1;

  if (FULL_BLEED_PATHS.has(location.pathname)) {
    return (
      <div className="h-screen flex flex-col bg-cream text-ink overflow-hidden">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-cream text-ink overflow-hidden">
      <Header currentStep={currentStep} totalSteps={totalSteps} />
      <main className="flex-1 flex flex-col min-h-0 px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}

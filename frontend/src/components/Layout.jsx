import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import { useCheckout } from "../context/CheckoutContext";

const ROUTE_STEP = {
  "/": 1,
  "/auth": 2,
  "/instruction": 3,
  "/scan": 4,
  "/cart": 5,
  "/payment": 6,
  "/evidence": 7,
  "/complete": 8,
};

const TOTAL_STEPS = 8;

export default function Layout() {
  const location = useLocation();
  const { cartCount, totalAmount } = useCheckout();
  const currentStep = ROUTE_STEP[location.pathname] || 1;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        cartCount={cartCount}
        totalAmount={totalAmount}
      />
      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-6xl h-[70vh] md:h-[75vh] bg-slate-50 rounded-3xl shadow-2xl border border-slate-200 p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

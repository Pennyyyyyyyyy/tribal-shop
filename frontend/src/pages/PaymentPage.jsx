import React from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";

export default function PaymentPage() {
  const navigate = useNavigate();
  const { totalAmount, isTribalMember, setPaymentMethod } = useCheckout();

  if (isTribalMember) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
        <h2 className="text-3xl font-bold text-slate-800">結帳</h2>
        <p className="text-lg text-slate-600">
          你目前選的是「族人」，請使用賒帳流程結帳。
        </p>
        <div className="flex flex-col md:flex-row gap-4">
          <button
            onClick={() => navigate("/auth")}
            className="px-10 py-5 rounded-2xl bg-slate-800 text-white text-xl font-bold shadow-lg hover:bg-slate-700 transition-transform hover:scale-105 active:scale-95"
          >
            📘 前往賒帳驗證
          </button>
          <button
            onClick={() => navigate("/cart")}
            className="px-10 py-5 rounded-2xl bg-slate-100 text-slate-700 text-xl font-bold shadow-md hover:bg-slate-200"
          >
            ⬅ 返回購物車
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 text-center">
      <h2 className="text-3xl font-bold text-slate-800">Line Pay 結帳</h2>
      <p className="text-lg text-slate-600">
        本次消費金額：
        <span className="text-2xl text-green-700 font-semibold">
          ${totalAmount}
        </span>
      </p>

      <button
        data-testid="btn-linepay"
        onClick={() => {
          setPaymentMethod("Linepay");
          alert("模擬：已轉 Linepay Money 給飛鼠");
          navigate("/complete");
        }}
        className="px-10 py-5 rounded-2xl bg-emerald-600 text-white text-xl font-bold shadow-lg hover:bg-emerald-500 transition-transform hover:scale-105 active:scale-95"
      >
        LinePay 付款
      </button>

      <button
        onClick={() => navigate("/cart")}
        className="mt-4 text-slate-500 underline text-sm"
      >
        ⬅ 返回購物車
      </button>
    </div>
  );
}

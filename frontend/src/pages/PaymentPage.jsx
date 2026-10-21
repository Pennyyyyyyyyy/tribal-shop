import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import { useVoiceInstruction } from "../hooks/useVoiceInstruction";

export default function PaymentPage() {
  const navigate = useNavigate();
  const { totalAmount, isTribalMember, setPaymentMethod, resetAll, API_BASE_URL } =
    useCheckout();

  const [insertedAmount, setInsertedAmount] = useState(0);
  const remaining = Math.max(0, totalAmount - insertedAmount);

  // 語音指示 (無語音指令，純語音引導)
  useVoiceInstruction(
    isTribalMember
      ? "請使用賒帳流程完成結帳"
      : insertedAmount >= totalAmount
      ? "投入金額已達標，感謝您的購買，即將為您完成結帳！"
      : insertedAmount > 0
      ? `已投入 ${insertedAmount} 元，還差 ${remaining} 元。`
      : `本次消費金額 ${totalAmount} 元，請將硬幣投入投幣機。`,
    [isTribalMember, totalAmount, insertedAmount, remaining]
  );

  // 監聽後端投幣機 WebSocket 廣播
  useEffect(() => {
    if (isTribalMember) return;

    let ws;
    try {
      const baseUrl = API_BASE_URL || "http://127.0.0.1:8000";
      const wsUrl = baseUrl.replace(/^http/, "ws") + "/ws/payment";
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "coin_inserted" && data.amount) {
            setInsertedAmount((prev) => prev + Number(data.amount));
          }
        } catch (err) {
          console.error("解析投幣機訊號錯誤:", err);
        }
      };

      ws.onerror = (err) => {
        console.warn("投幣機 WebSocket 連線異常，仍可手動點擊完成:", err);
      };
    } catch (e) {
      console.warn("WebSocket 初始化失敗:", e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, [isTribalMember, API_BASE_URL]);

  const handleComplete = () => {
    setPaymentMethod("Cash");
    resetAll();
    navigate("/");
  };

  // 當投入金額達到或超過消費金額，延遲 1.5 秒自動完成結帳
  useEffect(() => {
    if (!isTribalMember && totalAmount > 0 && insertedAmount >= totalAmount) {
      const timer = setTimeout(() => {
        handleComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [insertedAmount, totalAmount, isTribalMember]);

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
    <div className="flex flex-col items-center justify-center h-full space-y-8 text-center max-w-xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-800">請投入硬幣或現金</h2>

      <div className="flex flex-col items-center space-y-2 bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm w-full">
        <p className="text-lg text-slate-600">本次消費金額</p>
        <div className="text-4xl text-slate-800 font-bold mb-4">
          ${totalAmount}
        </div>

        <div className="w-full h-px bg-slate-200 my-2"></div>

        <p className="text-lg text-slate-600">投幣機已投入金額</p>
        <div className="text-5xl text-emerald-600 font-black mb-2 transition-all duration-300">
          ${insertedAmount}
        </div>

        {remaining > 0 ? (
          <p className="text-rose-500 font-semibold text-lg mt-2">
            還差 ${remaining} 元
          </p>
        ) : (
          <p className="text-emerald-600 font-bold mt-4 text-xl animate-bounce">
            ✅ 投入金額已達標，即將完成結帳...
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
        <button
          onClick={handleComplete}
          className={`px-8 py-4 rounded-2xl text-white text-lg font-bold shadow-md transition-transform hover:scale-105 active:scale-95 ${
            insertedAmount >= totalAmount
              ? "bg-emerald-600 hover:bg-emerald-500"
              : "bg-slate-400 hover:bg-slate-500"
          }`}
        >
          {insertedAmount >= totalAmount ? "立即完成結帳" : "紙鈔/零錢已手動投入 (直接完成)"}
        </button>

        <button
          onClick={() => navigate("/evidence")}
          className="px-6 py-4 rounded-2xl bg-slate-100 text-slate-700 text-lg font-semibold hover:bg-slate-200"
        >
          ⬅ 返回拍照存證
        </button>
      </div>
    </div>
  );
}

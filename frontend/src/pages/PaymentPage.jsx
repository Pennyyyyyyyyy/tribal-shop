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
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
        <h1 className="font-display text-[44px]">結帳</h1>
        <p className="text-[22px]">你目前選的是「族人」，請使用賒帳流程結帳。</p>
        <div className="flex gap-5">
          <button
            onClick={() => navigate("/auth")}
            className="btn-press h-[72px] px-8 bg-forest text-paper text-2xl"
          >
            前往賒帳驗證
          </button>
          <button
            onClick={() => navigate("/cart")}
            className="btn-ghost h-[72px] px-8 text-xl"
          >
            返回購物車
          </button>
        </div>
      </div>
    );
  }

  const paidPercent = totalAmount > 0 ? Math.min(100, Math.round((insertedAmount / totalAmount) * 100)) : 0;
  const reached = insertedAmount >= totalAmount;

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_380px] gap-10 px-6 py-4">
      <section className="panel rounded-[28px] shadow-press-lg px-12 py-10 flex flex-col justify-center gap-7">
        <div className="text-[22px] font-bold">已投入金額</div>
        <div className="flex items-baseline gap-[18px]">
          <span className="font-display text-[150px] leading-[.9] text-forest transition-all duration-300">
            {insertedAmount}
          </span>
          <span className="font-display text-[44px] opacity-55">/ {totalAmount} 元</span>
        </div>
        <div
          className="h-9 border-[3px] border-ink rounded-full bg-cream overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalAmount}
          aria-valuenow={insertedAmount}
          aria-label="已投入金額"
        >
          <div
            className={`h-full bg-moss transition-all duration-300 ${paidPercent > 0 && paidPercent < 100 ? "border-r-[3px] border-ink" : ""}`}
            style={{ width: `${paidPercent}%` }}
          />
        </div>
        {reached ? (
          <div className="text-[28px] font-bold text-forest">
            投入金額已達標，即將完成結帳…
          </div>
        ) : (
          <div className="flex justify-between items-baseline text-[22px]">
            <span>還差</span>
            <span className="font-display text-[52px] text-rust">NT${remaining}</span>
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-5">
        <h1 className="font-display text-[44px] leading-tight">
          請投入
          <br />
          硬幣或紙鈔
        </h1>
        <p className="text-xl leading-[1.7]">
          請把錢投入投幣機，金額投滿後會自動完成結帳。
        </p>
        <div className="bg-peach border-[3px] border-ink rounded-[20px] px-5 py-4 flex justify-between items-baseline">
          <span className="text-lg font-bold">本次消費</span>
          <span className="font-display text-[34px]">NT${totalAmount}</span>
        </div>
        <button
          onClick={handleComplete}
          className="btn-press mt-auto h-[72px] px-4 bg-forest text-paper text-[22px] text-center"
        >
          {reached ? "立即完成結帳" : "紙鈔已手動投入，直接完成"}
        </button>
        <button
          onClick={() => navigate("/evidence")}
          className="btn-ghost h-14 text-lg"
        >
          返回拍照存證
        </button>
      </aside>
    </div>
  );
}

import React from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import { useVoiceInstruction } from "../hooks/useVoiceInstruction";
import BrandMark from "../components/BrandMark";

export default function WelcomePage() {
  const navigate = useNavigate();
  const { setIsTribalMember } = useCheckout();

  // 語音指示
  useVoiceInstruction("歡迎來到 Go-Remote 自助結帳系統，請在畫面上選擇您的身份。");

  return (
    <div className="relative flex-1 overflow-hidden">
      <img
        src="/welcome-bg.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="absolute left-14 top-10">
        <BrandMark size="lg" />
      </div>

      <div className="relative h-full flex flex-col justify-center gap-5 pl-24 max-w-[656px]">
        <h1 className="font-display text-[132px] leading-none tracking-tight">
          Welcome!
        </h1>
        <p className="text-[28px] font-medium leading-normal">
          歡迎來到 Go-Remote 自助結帳系統
        </p>
        <p className="mt-2 text-xl opacity-80">請選擇您的身份</p>

        <div className="flex gap-7 mt-1">
          <button
            data-testid="btn-guest"
            onClick={() => {
              setIsTribalMember(false);
              navigate("/instruction");
            }}
            className="btn-press w-[216px] h-24 rounded-[20px] shadow-press-lg bg-clay text-paper text-4xl"
          >
            遊客
          </button>

          <button
            data-testid="btn-tribal"
            onClick={() => {
              setIsTribalMember(true);
              navigate("/auth");
            }}
            className="btn-press w-[216px] h-24 rounded-[20px] shadow-press-lg bg-forest text-paper text-4xl"
          >
            族人
          </button>
        </div>
      </div>
    </div>
  );
}

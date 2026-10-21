import React from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import { useVoiceInstruction } from "../hooks/useVoiceInstruction";

export default function WelcomePage() {
  const navigate = useNavigate();
  const { setIsTribalMember } = useCheckout();

  // 語音指示
  useVoiceInstruction("歡迎來到飛鼠商店自助結帳系統，請在畫面上選擇您的身份。");

  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center space-y-8">
      <div className="text-6xl mb-2">👋</div>
      <h2 className="text-4xl font-bold text-slate-800">Welcome!</h2>
      <p className="text-xl text-slate-600">
        歡迎來到飛鼠商店自助結帳系統
      </p>

      <div className="flex flex-col md:flex-row gap-6 mt-6">
        <button
          data-testid="btn-guest"
          onClick={() => {
            setIsTribalMember(false);
            navigate("/instruction");
          }}
          className="px-10 py-5 rounded-2xl bg-green-600 hover:bg-green-500 text-white text-2xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          遊客
        </button>

        <button
          data-testid="btn-tribal"
          onClick={() => {
            setIsTribalMember(true);
            navigate("/auth");
          }}
          className="px-10 py-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-2xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          族人
        </button>
      </div>
    </div>
  );
}

import React from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import BrandMark from "../components/BrandMark";

export default function CompletePage() {
  const navigate = useNavigate();
  const { resetAll } = useCheckout();

  const handleBackHome = () => {
    resetAll();
    navigate("/");
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      <img
        src="/complete-bg.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="absolute left-14 top-10 z-10">
        <BrandMark size="lg" onClick={handleBackHome} />
      </div>

      <div className="relative h-full flex flex-col justify-center gap-6 pl-24 max-w-[656px]">
        <h1 className="font-display text-[112px] leading-none text-forest whitespace-nowrap">
          Thank you!
        </h1>
        <p className="text-2xl leading-[1.7]">
          感謝您的購買。店長會再確認存貨與消費內容，有問題會主動與您聯繫。
        </p>
        <button
          type="button"
          data-testid="btn-final-submit"
          onClick={handleBackHome}
          className="btn-press focus-ring self-start mt-2 w-[216px] h-20 bg-clay text-paper text-[30px]"
        >
          回到首頁
        </button>
      </div>
    </div>
  );
}

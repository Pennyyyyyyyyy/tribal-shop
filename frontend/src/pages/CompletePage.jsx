import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import BrandMark from "../components/BrandMark";

function Star({ filled }) {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" stroke="#4A2C1A" strokeWidth="1.6" strokeLinejoin="round" fill={filled ? "#F6C9A3" : "none"} aria-hidden="true">
      <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" />
    </svg>
  );
}

export default function CompletePage() {
  const navigate = useNavigate();
  const { resetAll } = useCheckout();

  const [rating, setRating] = useState(0);

  const handleFinalSubmit = () => {
    console.log("評分：", rating);
    resetAll();
    navigate("/");
  };

  return (
    <div className="relative flex-1 grid grid-cols-[minmax(0,1fr)_540px] gap-16 p-24 items-center">
      <div className="absolute left-14 top-10">
        <BrandMark size="lg" />
      </div>

      <div className="flex flex-col gap-6">
        <h1 className="font-display text-[112px] leading-none text-forest">Thank you!</h1>
        <p className="text-2xl leading-[1.7] max-w-[26em]">
          感謝您的購買。店長會再確認存貨與消費內容，有問題會主動與您聯繫。
        </p>
      </div>

      <section className="panel rounded-[28px] shadow-press-lg p-8 flex flex-col gap-[18px]">
        <h2 className="font-display text-[28px]">今天的自助結帳順利嗎？</h2>
        <div className="flex gap-1.5" role="radiogroup" aria-label="評分">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={rating === star}
              aria-label={`${star} 顆星`}
              onClick={() => setRating(star)}
              className="focus-ring w-16 h-16 flex items-center justify-center rounded-xl active:scale-95 transition"
            >
              <Star filled={rating >= star} />
            </button>
          ))}
        </div>
        <div className="text-base">
          {rating > 0 ? `已給 ${rating} 顆星` : "點星星評分"}
        </div>
        <button
          data-testid="btn-final-submit"
          onClick={handleFinalSubmit}
          className="btn-press h-[76px] bg-clay text-paper text-[28px]"
        >
          送出並回到首頁
        </button>
      </section>
    </div>
  );
}

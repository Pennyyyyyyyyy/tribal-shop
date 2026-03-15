import React from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";

export default function CartPage() {
  const navigate = useNavigate();
  const { cart, increaseQty, decreaseQty, totalAmount, isTribalMember } =
    useCheckout();

  return (
    <div className="flex flex-col w-full h-full">
      <div className="mb-4">
        <h2 className="text-3xl font-bold text-slate-800">購物車清單</h2>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-inner border border-slate-100 p-6 overflow-auto">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
            <div className="text-5xl">🛒</div>
            <div className="text-lg">目前購物車是空的，請先辨識商品。</div>
            <button
              onClick={() => navigate("/scan")}
              className="mt-2 px-6 py-3 rounded-2xl bg-green-600 text-white font-semibold hover:bg-green-500 shadow-md"
            >
              開始辨識商品
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-4 border border-slate-100"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="text-3xl shrink-0">{item.image}</div>
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-slate-800 truncate">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      單價：${item.price}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => decreaseQty(item.id)}
                    className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 text-2xl font-bold shadow-sm hover:bg-slate-100 active:scale-95 transition"
                    aria-label="減少數量"
                  >
                    −
                  </button>

                  <div className="w-16 text-center">
                    <div className="text-xs text-slate-500">數量</div>
                    <div className="text-2xl font-bold text-slate-800">
                      {item.quantity}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => increaseQty(item.id)}
                    className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 text-2xl font-bold shadow-sm hover:bg-slate-100 active:scale-95 transition"
                    aria-label="增加數量"
                  >
                    +
                  </button>
                </div>

                <div className="text-right w-28">
                  <div className="text-lg font-bold text-green-700">
                    ${item.price * item.quantity}
                  </div>
                  <div className="text-xs text-slate-400">小計</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between">
        {cart.length > 0 ? (
          <button
            onClick={() => navigate("/scan")}
            className="px-5 py-3 rounded-2xl bg-sky-100 text-sky-800 text-base font-semibold hover:bg-sky-200 transition"
          >
            繼續辨識商品
          </button>
        ) : (
          <div />
        )}
        <div className="text-right flex flex-col items-end gap-4">
          <div className="text-[27.2px] font-bold text-slate-800">
            <span className="text-slate-800">總金額：</span>
            <span className="text-green-700">${totalAmount}</span>
          </div>

          <div className="flex gap-4">
            <button
              data-testid="btn-checkout"
              disabled={cart.length === 0}
              onClick={() => {
                navigate(isTribalMember ? "/evidence" : "/payment");
              }}
              className={`px-10 py-5 rounded-2xl text-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 whitespace-nowrap ${
                cart.length === 0
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-sky-600 text-white hover:bg-sky-500"
              }`}
            >
              🛒 結帳
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

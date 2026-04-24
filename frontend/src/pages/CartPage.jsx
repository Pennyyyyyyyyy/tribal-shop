import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import RecipePopup from "../components/RecipePopup";
import { RECIPES, getMakauCartItem, detectCategory } from "../data/recipes";
import { useVoiceCommand } from "../hooks/useVoiceCommand";
import { useVoiceInstruction } from "../hooks/useVoiceInstruction";

function pickPopupMode(cart) {
  const { hasCoffee, hasTea, hasNoodle, hasMakau } = detectCategory(cart);
  const matched = [];
  if (hasCoffee) matched.push(RECIPES.coffee);
  if (hasTea) matched.push(RECIPES.tea);
  if (hasNoodle) matched.push(RECIPES.noodle);

  if (matched.length === 0) return { mode: "educate", recipe: null };
  if (hasMakau) return { mode: "celebrate", recipe: matched[0] };
  return { mode: "promote", recipe: matched[0] };
}

export default function CartPage() {
  const navigate = useNavigate();
  const {
    cart,
    increaseQty,
    decreaseQty,
    totalAmount,
    isTribalMember,
    addItemToCart,
    products,
  } = useCheckout();

  const [popup, setPopup] = useState({ mode: null, recipe: null });

  const closePopup = () => setPopup({ mode: null, recipe: null });

  const handleCheckoutClick = () => {
    if (cart.length === 0) return;
    if (isTribalMember) {
      navigate("/evidence");
      return;
    }
    setPopup(pickPopupMode(cart));
  };

  const handleSkip = () => {
    closePopup();
    navigate("/evidence");
  };

  const handleAddMakau = () => {
    const item = getMakauCartItem(products);
    if (item) addItemToCart(item);
    closePopup();
  };

  const handleAddProducts = (products) => {
    products.forEach((p) => addItemToCart(p));
    closePopup();
  };

  // 語音指示
  useVoiceInstruction(
    cart.length > 0 
      ? `購物車目前有 ${cart.length} 項商品，總金額為 ${totalAmount} 元。確認無誤請說出：結帳。或點選繼續辨識。` 
      : "購物車目前是空的，請點選繼續辨識商品。",
    [cart.length, totalAmount]
  );

  // 語音指令
  useVoiceCommand({
    "結帳": () => { if (cart.length > 0) handleCheckoutClick(); },
    "繼續辨識": () => { navigate("/scan"); }
  });

  return (
    <div className="flex flex-col w-full flex-1 min-h-[60vh]">
      <div className="mb-4">
        <h2 className="text-3xl font-bold text-slate-800">購物車清單</h2>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-inner border border-slate-100 p-6 overflow-auto min-h-0">
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
                className="grid grid-cols-[auto_1fr_auto_100px] items-center gap-4 bg-slate-50 rounded-2xl px-4 py-4 border border-slate-100"
              >
                <div className="w-16 h-16 shrink-0 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={
                        item.image_url.startsWith("http")
                          ? item.image_url
                          : item.image_url.replace(
                              "/uploads/product_photos/",
                              "/photo/"
                            )
                      }
                      alt={item.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-3xl">{item.image}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-slate-800 truncate">
                    {item.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    單價：NT${item.price}
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

                <div className="text-right">
                  <div className="text-lg font-bold text-green-700">
                    NT${item.price * item.quantity}
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
            className="px-5 py-3 rounded-2xl bg-slate-200 text-slate-700 text-base font-semibold hover:bg-slate-300 transition"
          >
            繼續辨識商品
          </button>
        ) : (
          <div />
        )}
        <div className="text-right flex flex-col items-end gap-4">
          <div className="text-[27.2px] font-bold text-slate-800">
            <span className="text-slate-800">總金額：</span>
            <span className="text-green-700">NT${totalAmount}</span>
          </div>

          <div className="flex gap-4">
            <button
              data-testid="btn-checkout"
              disabled={cart.length === 0}
              onClick={handleCheckoutClick}
              className={`px-10 py-5 rounded-2xl text-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 whitespace-nowrap ${
                cart.length === 0
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-500"
              }`}
            >
              🛒 結帳
            </button>
          </div>
        </div>
      </div>

      <RecipePopup
        mode={popup.mode}
        recipe={popup.recipe}
        onAddMakau={handleAddMakau}
        onAddProducts={handleAddProducts}
        onSkip={handleSkip}
        onClose={closePopup}
      />
    </div>
  );
}

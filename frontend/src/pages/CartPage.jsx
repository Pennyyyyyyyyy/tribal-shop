import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import RecipePopup from "../components/RecipePopup";
import { RECIPES, detectCategory } from "../data/recipes";
import { getMakauCartItem } from "../data/catalog";

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
    recipeShown,
    setRecipeShown,
  } = useCheckout();

  const [popup, setPopup] = useState({ mode: null, recipe: null });

  const closePopup = () => setPopup({ mode: null, recipe: null });

  const handleCheckoutClick = () => {
    if (cart.length === 0) return;
    // 居民不推薦；遊客已經看過一次推薦，就直接進下一步
    if (isTribalMember || recipeShown) {
      navigate("/evidence");
      return;
    }
    setRecipeShown(true);
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


  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const qtyClass =
    "focus-ring w-[52px] h-[52px] rounded-full border-[3px] border-ink text-[26px] font-bold flex items-center justify-center active:scale-95 transition";

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_340px] grid-rows-[auto_minmax(0,1fr)] gap-x-7 gap-y-[18px]">
      <h1 className="col-span-full font-display text-[38px]">購物車清單</h1>

      <section className="panel rounded-3xl p-[18px] overflow-auto min-h-0">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="text-xl">目前購物車是空的，請先辨識商品。</div>
            <button
              onClick={() => navigate("/scan")}
              className="btn-press h-16 px-8 bg-forest text-paper text-2xl"
            >
              開始辨識商品
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-[18px] bg-cream rounded-[18px] py-3 pl-3.5 pr-[22px]"
              >
                <div className="w-[68px] h-[68px] shrink-0 rounded-[14px] border-[3px] border-sand bg-paper flex items-center justify-center overflow-hidden">
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
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[21px] truncate">{item.name}</div>
                  <div className="text-[15px] mt-0.5">單價 NT${item.price}</div>
                </div>

                <button
                  type="button"
                  onClick={() => decreaseQty(item.id)}
                  className={`${qtyClass} bg-paper`}
                  aria-label="減少數量"
                >
                  −
                </button>
                <span className="w-9 text-center font-display text-[30px]">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => increaseQty(item.id)}
                  className={`${qtyClass} bg-forest text-paper`}
                  aria-label="增加數量"
                >
                  +
                </button>

                <div className="w-[120px] text-right">
                  <div className="font-display text-[26px] text-rust">
                    NT${item.price * item.quantity}
                  </div>
                  <div className="text-[13px]">小計</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-5">
        <div className="panel rounded-3xl shadow-press p-6 flex flex-col gap-[18px]">
          <div className="flex justify-between text-lg pb-4 border-b-2 border-dashed border-sand">
            <span>商品數量</span>
            <span className="font-bold">{itemCount} 件</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-lg font-bold">總金額</span>
            <span className="font-display text-[46px] text-forest">NT${totalAmount}</span>
          </div>
          <button
            data-testid="btn-checkout"
            disabled={cart.length === 0}
            onClick={handleCheckoutClick}
            className="btn-press h-[84px] bg-clay text-paper text-[34px]"
          >
            結帳
          </button>
          <button
            onClick={() => navigate("/scan")}
            className="btn-ghost h-14 text-lg"
          >
            返回辨識商品
          </button>
        </div>

        <div className="px-2 text-base leading-[1.7]">
          {isTribalMember ? (
            <>
              <div className="font-bold mb-1.5">結帳後還有一步</div>
              <div>拍照存證：拍下您的臉，店長確認後記入賒帳</div>
            </>
          ) : (
            <>
              <div className="font-bold mb-1.5">結帳後還有兩步</div>
              <div>1. 拍照存證：拍下您的臉</div>
              <div>2. 投幣付款：投入硬幣或紙鈔</div>
            </>
          )}
        </div>
      </aside>

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

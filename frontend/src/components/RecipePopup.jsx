import React, { useState } from "react";
import { RECIPES } from "../data/recipes";
import {
  productToCartItem,
  findProductByName,
  getNoodleProducts,
} from "../data/catalog";
import { useCheckout } from "../context/CheckoutContext";

export default function RecipePopup({
  mode,
  recipe,
  onAddMakau,
  onAddProducts,
  onSkip,
  onClose,
}) {
  const [lightboxRecipe, setLightboxRecipe] = useState(null);

  if (!mode) return null;

  const openLightbox = (r) => setLightboxRecipe(r);
  const closeLightbox = () => setLightboxRecipe(null);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-cocoa/60 backdrop-blur-sm px-4"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-xl rounded-[28px] bg-paper border-[3px] border-ink shadow-press-lg overflow-hidden text-ink"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="關閉"
            onClick={onClose}
            className="focus-ring absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full text-paper hover:bg-paper/20 transition z-10"
          >
            <span className="text-2xl leading-none">×</span>
          </button>

          {mode === "promote" && recipe && (
            <PromoteBody
              recipe={recipe}
              onAddMakau={onAddMakau}
              onSkip={onSkip}
              onViewRecipe={() => openLightbox(recipe)}
            />
          )}

          {mode === "celebrate" && recipe && (
            <CelebrateBody
              recipe={recipe}
              onClose={onSkip}
              onViewRecipe={() => openLightbox(recipe)}
            />
          )}

          {mode === "educate" && (
            <EducateBody
              onClose={onSkip}
              onViewRecipe={openLightbox}
              onAddProducts={onAddProducts}
            />
          )}
        </div>
      </div>

      {lightboxRecipe && (
        <RecipeLightbox recipe={lightboxRecipe} onClose={closeLightbox} />
      )}
    </>
  );
}

function RecipeHero({ recipe, onViewRecipe }) {
  return (
    <button
      type="button"
      onClick={onViewRecipe}
      className="relative w-full h-56 overflow-hidden block group border-b-[3px] border-ink"
      aria-label={`查看 ${recipe.title} 食譜`}
    >
      <img
        src={recipe.dishPhoto}
        alt={recipe.title}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-cocoa/80 via-cocoa/30 to-transparent" />
      <div className="absolute top-4 left-6 text-xs font-semibold tracking-widest text-paper/80 uppercase">
        Tayal Recipe
      </div>
      <div className="absolute top-4 right-16 rounded-full bg-peach text-ink text-xs font-bold px-3 py-1">
        點選查看食譜
      </div>
      <div className="absolute bottom-6 left-6 right-6 text-left text-paper">
        <div className="font-display text-[28px] drop-shadow">{recipe.title}</div>
      </div>
    </button>
  );
}

function PromoteBody({ recipe, onAddMakau, onSkip, onViewRecipe }) {
  return (
    <>
      <RecipeHero recipe={recipe} onViewRecipe={onViewRecipe} />
      <div className="p-7">
        <h2 className="font-display text-[26px] leading-snug">
          加入馬告讓你的{recipe.category}多一種風味！
        </h2>
        <p className="mt-3 text-lg leading-relaxed opacity-85">
          {recipe.description}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="btn-ghost flex-1 h-14 text-lg"
          >
            忍痛放棄
          </button>
          <button
            type="button"
            onClick={onAddMakau}
            className="btn-press flex-[1.3] h-14 bg-clay text-paper text-xl"
          >
            ＋ 加入馬告
          </button>
        </div>
      </div>
    </>
  );
}

function CelebrateBody({ recipe, onClose, onViewRecipe }) {
  return (
    <>
      <RecipeHero recipe={recipe} onViewRecipe={onViewRecipe} />
      <div className="p-7">
        <h2 className="font-display text-[26px] leading-snug">
          你知道馬告加入{recipe.category}可以添加更多風味嗎？
        </h2>
        <p className="mt-3 text-lg leading-relaxed opacity-85">
          {recipe.description}
        </p>

        <div className="mt-5 rounded-2xl bg-moss/50 border-2 border-forest/40 p-4 text-base">
          你已經備好所有材料，回家後試試看「{recipe.title}」吧！
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onViewRecipe}
            className="btn-ghost flex-1 h-14 text-lg"
          >
            查看完整食譜
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-press flex-1 h-14 bg-forest text-paper text-xl"
          >
            繼續結帳 →
          </button>
        </div>
      </div>
    </>
  );
}

function EducateBody({ onClose, onViewRecipe, onAddProducts }) {
  const { products } = useCheckout();
  const list = Object.values(RECIPES);
  const [menu, setMenu] = useState(null); // null | "main" | "noodle"

  const addComboByNames = (names) => {
    if (!onAddProducts) return;
    const items = names
      .map((n) => findProductByName(products, n))
      .filter(Boolean)
      .map((p) => productToCartItem(p));
    onAddProducts(items);
  };

  return (
    <div className="bg-forest text-paper px-7 pt-10 pb-7">
      <div className="text-xs font-semibold tracking-widest text-paper/70 uppercase">
        Tayal Recipe
      </div>
      <h2 className="mt-1 font-display text-[28px] leading-snug">
        你想不想了解泰雅族特色飲食呢？
      </h2>
      <p className="mt-2 text-paper/85 text-base">
        點選下方任一食譜，看看馬告如何為日常飲食帶來山林風味。
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {list.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => onViewRecipe(r)}
            className="focus-ring group relative text-left rounded-2xl overflow-hidden border-[3px] border-ink bg-paper text-ink hover:scale-[1.03] transition"
          >
            <div className="aspect-square overflow-hidden">
              <img
                src={r.dishPhoto}
                alt={r.title}
                className="w-full h-full object-cover group-hover:scale-105 transition"
              />
            </div>
            <span className="absolute top-2 right-2 rounded-full bg-peach text-ink text-[11px] font-bold px-2 py-0.5">
              點選查看食譜
            </span>
            <div className="border-t-[3px] border-ink px-3 py-2 text-center">
              <div className="text-sm font-bold">{r.title}</div>
            </div>
          </button>
        ))}
      </div>

      {menu === null && (
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost flex-1 h-14 text-lg"
          >
            忍痛放棄
          </button>
          <button
            type="button"
            onClick={() => setMenu("main")}
            className="btn-press flex-[1.4] h-14 bg-clay text-paper text-xl"
          >
            ＋ 一鍵新增產品到購物車
          </button>
        </div>
      )}

      {menu === "main" && (
        <div className="mt-6 rounded-2xl bg-paper/10 border-2 border-paper/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-base text-paper font-bold">
              選擇要加入的組合
            </div>
            <button
              type="button"
              onClick={() => setMenu(null)}
              className="text-sm text-paper/80 hover:text-paper underline"
            >
              取消
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <MenuItem
              label="馬告 ＋ 咖啡粉"
              onClick={() => addComboByNames(["馬告", "咖啡粉"])}
            />
            <MenuItem
              label="馬告 ＋ 冬瓜磚"
              onClick={() => addComboByNames(["馬告", "冬瓜磚"])}
            />
            <MenuItem
              label="馬告 ＋ 泡麵 ▸"
              onClick={() => setMenu("noodle")}
            />
          </div>
        </div>
      )}

      {menu === "noodle" && (
        <div className="mt-6 rounded-2xl bg-paper/10 border-2 border-paper/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-base text-paper font-bold">
              選擇泡麵（將一併加入馬告）
            </div>
            <button
              type="button"
              onClick={() => setMenu("main")}
              className="text-sm text-paper/80 hover:text-paper underline"
            >
              ← 返回
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {getNoodleProducts(products).map((n) => (
              <MenuItem
                key={n.id}
                label={`${n.name}　NT$${n.price}`}
                onClick={() => addComboByNames(["馬告", n.name])}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring text-left px-4 py-3 rounded-xl bg-paper text-ink font-bold hover:bg-wheat active:scale-95 transition"
    >
      {label}
    </button>
  );
}

function RecipeLightbox({ recipe, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-cocoa/90 px-4"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="關閉食譜"
        onClick={onClose}
        className="absolute top-5 right-5 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
      >
        <span className="text-3xl leading-none">×</span>
      </button>

      <div
        className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={recipe.recipePhoto}
          alt={`${recipe.title} 食譜`}
          className="max-h-[85vh] w-auto object-contain rounded-2xl border-[3px] border-ink bg-paper"
        />
        <div className="text-white/90 text-sm">{recipe.title}</div>
      </div>
    </div>
  );
}

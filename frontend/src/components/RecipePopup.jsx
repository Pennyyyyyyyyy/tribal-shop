import React, { useState } from "react";
import { RECIPES } from "../data/recipes";
import {
  catalogToCartItem,
  findProduct,
  getNoodleProducts,
} from "../data/catalog";

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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="關閉"
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full text-white/90 hover:bg-white/20 transition z-10"
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
      className="relative w-full h-56 overflow-hidden block group"
      aria-label={`查看 ${recipe.title} 食譜`}
    >
      <img
        src={recipe.dishPhoto}
        alt={recipe.title}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
      <div className="absolute top-4 left-6 text-xs font-semibold tracking-widest text-white/80 uppercase">
        Tayal Recipe
      </div>
      <div className="absolute top-4 right-14 rounded-full bg-white/90 text-slate-800 text-xs font-semibold px-3 py-1 shadow">
        點選查看食譜
      </div>
      <div className="absolute bottom-6 left-6 right-6 text-left text-white">
        <div className="text-2xl font-black drop-shadow">{recipe.title}</div>
      </div>
    </button>
  );
}

function PromoteBody({ recipe, onAddMakau, onSkip, onViewRecipe }) {
  return (
    <>
      <RecipeHero recipe={recipe} onViewRecipe={onViewRecipe} />
      <div className="p-7">
        <h2 className="text-2xl font-black text-slate-900 leading-snug">
          加入馬告讓你的{recipe.category}多一種風味！
        </h2>
        <p className="mt-3 text-slate-600 leading-relaxed">
          {recipe.description}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
          >
            忍痛放棄
          </button>
          <button
            type="button"
            onClick={onAddMakau}
            className="flex-[1.3] px-5 py-3 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 shadow-md active:scale-95 transition"
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
        <h2 className="text-2xl font-black text-slate-900 leading-snug">
          你知道馬告加入{recipe.category}可以添加更多風味嗎？
        </h2>
        <p className="mt-3 text-slate-600 leading-relaxed">
          {recipe.description}
        </p>

        <div className="mt-5 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900">
          你已經備好所有材料，回家後試試看「{recipe.title}」吧！
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onViewRecipe}
            className="flex-1 px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
          >
            查看完整食譜
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-5 py-3 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 shadow-md active:scale-95 transition"
          >
            繼續結帳 →
          </button>
        </div>
      </div>
    </>
  );
}

function EducateBody({ onClose, onViewRecipe, onAddProducts }) {
  const list = Object.values(RECIPES);
  const [menu, setMenu] = useState(null); // null | "main" | "noodle"

  const addComboByNames = (names) => {
    if (!onAddProducts) return;
    const items = names
      .map(findProduct)
      .filter(Boolean)
      .map((p) => catalogToCartItem(p));
    onAddProducts(items);
  };

  return (
    <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white px-7 pt-10 pb-7">
      <div className="text-xs font-semibold tracking-widest text-white/70 uppercase">
        Tayal Recipe
      </div>
      <h2 className="mt-1 text-2xl font-black leading-snug">
        你想不想了解泰雅族特色飲食呢？
      </h2>
      <p className="mt-2 text-white/80 text-sm">
        點選下方任一食譜，看看馬告如何為日常飲食帶來山林風味。
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {list.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => onViewRecipe(r)}
            className="group relative text-left rounded-2xl overflow-hidden ring-1 ring-white/20 hover:ring-white/70 hover:scale-[1.03] transition shadow-lg bg-black/20"
          >
            <div className="aspect-square overflow-hidden">
              <img
                src={r.dishPhoto}
                alt={r.title}
                className="w-full h-full object-cover group-hover:scale-105 transition"
              />
            </div>
            <span className="absolute top-2 right-2 rounded-full bg-white/90 text-slate-800 text-[11px] font-semibold px-2 py-0.5 shadow">
              點選查看食譜
            </span>
            <div className="bg-black/50 backdrop-blur-sm px-3 py-2 text-center">
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
            className="flex-1 px-5 py-3 rounded-2xl bg-white/90 text-slate-700 font-semibold hover:bg-white shadow-md active:scale-95 transition"
          >
            忍痛放棄
          </button>
          <button
            type="button"
            onClick={() => setMenu("main")}
            className="flex-[1.4] px-5 py-3 rounded-2xl bg-amber-400 text-amber-950 font-bold hover:bg-amber-300 shadow-md active:scale-95 transition"
          >
            ＋ 一鍵新增產品到購物車
          </button>
        </div>
      )}

      {menu === "main" && (
        <div className="mt-6 rounded-2xl bg-white/10 border border-white/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-white/90 font-semibold">
              選擇要加入的組合
            </div>
            <button
              type="button"
              onClick={() => setMenu(null)}
              className="text-xs text-white/70 hover:text-white underline"
            >
              取消
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <MenuItem
              label="馬告 ＋ 咖啡粉"
              onClick={() => addComboByNames(["馬告（山胡椒）", "咖啡粉"])}
            />
            <MenuItem
              label="馬告 ＋ 冬瓜磚"
              onClick={() => addComboByNames(["馬告（山胡椒）", "冬瓜磚"])}
            />
            <MenuItem
              label="馬告 ＋ 泡麵 ▸"
              onClick={() => setMenu("noodle")}
            />
          </div>
        </div>
      )}

      {menu === "noodle" && (
        <div className="mt-6 rounded-2xl bg-white/10 border border-white/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-white/90 font-semibold">
              選擇泡麵（將一併加入馬告）
            </div>
            <button
              type="button"
              onClick={() => setMenu("main")}
              className="text-xs text-white/70 hover:text-white underline"
            >
              ← 返回
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {getNoodleProducts().map((n) => (
              <MenuItem
                key={n.name}
                label={`${n.name}　NT$${n.price}`}
                onClick={() => addComboByNames(["馬告（山胡椒）", n.name])}
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
      className="text-left px-4 py-3 rounded-xl bg-white text-slate-800 font-semibold hover:bg-emerald-50 shadow-sm active:scale-95 transition"
    >
      {label}
    </button>
  );
}

function RecipeLightbox({ recipe, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 px-4"
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
          className="max-h-[85vh] w-auto object-contain rounded-2xl shadow-2xl bg-white"
        />
        <div className="text-white/90 text-sm">{recipe.title}</div>
      </div>
    </div>
  );
}

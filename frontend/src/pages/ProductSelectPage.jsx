import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import { CATALOG, CATEGORIES, catalogToCartItem } from "../data/catalog";

export default function ProductSelectPage() {
  const navigate = useNavigate();
  const { addItemToCart, cart, totalAmount, API_BASE_URL } = useCheckout();
  const [activeCategory, setActiveCategory] = useState("all");
  const [quantities, setQuantities] = useState({});

  const filtered =
    activeCategory === "all"
      ? CATALOG
      : CATALOG.filter((p) => p.category === activeCategory);

  const getQty = (name) => quantities[name] || 1;

  const setQty = (name, val) => {
    if (val < 1) val = 1;
    if (val > 99) val = 99;
    setQuantities((prev) => ({ ...prev, [name]: val }));
  };

  const handleAdd = (item) => {
    addItemToCart(catalogToCartItem(item, getQty(item.name)));
    setQuantities((prev) => ({ ...prev, [item.name]: 1 }));
  };

  return (
    <div className="w-full h-full flex gap-4">
      {/* 左側類別欄 */}
      <div className="w-28 shrink-0 flex flex-col gap-2 pt-2">
        <h3 className="text-sm font-semibold text-slate-500 mb-1 px-2">
          類別
        </h3>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`w-full text-left px-4 py-3 rounded-2xl text-base font-semibold transition ${activeCategory === cat.key
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
          >
            {cat.label}
          </button>
        ))}

        <div className="mt-auto pt-4">
          <button
            onClick={() => navigate("/scan")}
            className="w-full px-3 py-3 rounded-2xl bg-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-300 transition"
          >
            返回掃描
          </button>
        </div>
      </div>

      {/* 右側商品區 */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
            {filtered.map((item) => (
              <div
                key={item.name}
                data-testid={`product-card-${item.name}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-slate-50 flex items-center justify-center p-3">
                  <img
                    src={item.photo}
                    alt={item.name}
                    className="max-w-full max-h-full object-contain mx-auto"
                  />
                </div>

                <div className="p-3 flex flex-col gap-1.5">
                  <div className="text-sm font-bold text-slate-800 truncate">
                    {item.name}
                  </div>
                  <div className="text-base font-bold text-emerald-700">
                    ${item.price}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setQty(item.name, getQty(item.name) - 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 text-base font-bold hover:bg-slate-200 active:scale-95 transition"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-base font-bold text-slate-800">
                      {getQty(item.name)}
                    </span>
                    <button
                      onClick={() => setQty(item.name, getQty(item.name) + 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 text-base font-bold hover:bg-slate-200 active:scale-95 transition"
                    >
                      +
                    </button>
                  </div>

                  <button
                    data-testid={`btn-add-${item.name}`}
                    onClick={() => handleAdd(item)}
                    className="w-full px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 shadow-md active:scale-95 transition"
                  >
                    加入購物車
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部購物車列 */}
        <div className="mt-3 bg-white rounded-2xl border border-slate-200 px-5 py-3 flex items-center justify-between">
          <div className="text-slate-700">
            <span className="text-sm text-slate-500">購物車</span>
            <span className="text-xl font-bold ml-2">
              {cart.length} 項 · ${totalAmount}
            </span>
          </div>
          <button
            onClick={() => navigate("/cart")}
            className="px-6 py-3 rounded-2xl bg-sky-600 text-white font-bold text-lg hover:bg-sky-500 shadow-lg active:scale-95 transition"
          >
            查看清單
          </button>
        </div>
      </div>
    </div>
  );
}

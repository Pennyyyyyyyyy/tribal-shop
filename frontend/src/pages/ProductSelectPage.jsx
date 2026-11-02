import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import CartIcon from "../components/CartIcon";

const normalizeCategory = (c) => (c || "").trim();

export default function ProductSelectPage() {
  const navigate = useNavigate();
  const { addItemToCart, cart, totalAmount, products } = useCheckout();
  const [activeCategory, setActiveCategory] = useState("all");
  const [quantities, setQuantities] = useState({});

  const categories = useMemo(() => {
    const set = new Set();
    for (const p of products) {
      const c = normalizeCategory(p.category);
      if (c) set.add(c);
    }
    return [{ key: "all", label: "全部" }, ...Array.from(set).map((c) => ({ key: c, label: c }))];
  }, [products]);

  const filtered =
    activeCategory === "all"
      ? products
      : products.filter((p) => normalizeCategory(p.category) === activeCategory);

  const getQty = (name) => quantities[name] || 1;

  const setQty = (name, val) => {
    if (val < 1) val = 1;
    if (val > 99) val = 99;
    setQuantities((prev) => ({ ...prev, [name]: val }));
  };

  const handleAdd = (item) => {
    addItemToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      image_url: item.image_url,
      quantity: getQty(item.name),
    });
    setQuantities((prev) => ({ ...prev, [item.name]: 1 }));
  };

  const stepClass =
    "focus-ring w-[34px] h-[34px] rounded-full bg-paper text-xl font-bold flex items-center justify-center active:scale-95 transition";

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[150px_minmax(0,1fr)] gap-6">
      {/* 左側類別欄 */}
      <nav className="flex flex-col gap-3 min-h-0" aria-label="類別">
        <div className="text-[15px] font-bold pl-1">類別</div>
        <div className="flex flex-col gap-3 overflow-y-auto">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              aria-pressed={activeCategory === cat.key}
              className={`focus-ring shrink-0 h-14 rounded-2xl border-[3px] px-[18px] text-left text-lg font-bold transition ${
                activeCategory === cat.key
                  ? "bg-clay text-paper border-ink shadow-press-sm"
                  : "bg-paper border-sand hover:border-clay"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => navigate("/scan")}
          className="btn-ghost mt-auto h-14 text-[17px] shrink-0"
        >
          返回掃描
        </button>
      </nav>

      {/* 右側商品區 */}
      <div className="flex flex-col gap-5 min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto p-0.5 pb-2">
          <div className="grid grid-cols-4 gap-5">
            {filtered.map((item) => (
              <article
                key={item.name}
                data-testid={`product-card-${item.name}`}
                className="bg-paper border-[3px] border-ink rounded-[22px] shadow-press overflow-hidden"
              >
                <div className="h-[120px] bg-wheat border-b-[3px] border-ink flex items-center justify-center p-2">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain rounded-md"
                  />
                </div>

                <div className="px-3.5 pt-3 pb-3.5 flex flex-col gap-2.5">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-bold text-lg truncate">{item.name}</span>
                    <span className="font-display text-[22px] text-rust shrink-0">NT${item.price}</span>
                  </div>

                  <div className="flex gap-2.5 items-center">
                    <div className="flex items-center gap-1.5 bg-wheat rounded-full p-1">
                      <button
                        onClick={() => setQty(item.name, getQty(item.name) - 1)}
                        className={stepClass}
                        aria-label="減少"
                      >
                        −
                      </button>
                      <span className="min-w-4 text-center font-bold text-lg">
                        {getQty(item.name)}
                      </span>
                      <button
                        onClick={() => setQty(item.name, getQty(item.name) + 1)}
                        className={stepClass}
                        aria-label="增加"
                      >
                        +
                      </button>
                    </div>

                    <button
                      data-testid={`btn-add-${item.name}`}
                      onClick={() => handleAdd(item)}
                      className="btn-press flex-1 h-11 rounded-[14px] shadow-press-sm bg-forest text-paper text-lg"
                    >
                      加入
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* 底部購物車列 */}
        <div className="panel flex items-center gap-4 py-3.5 pr-4 pl-7 shrink-0">
          <CartIcon />
          <span className="text-[17px]">購物車</span>
          <span className="font-display text-[30px]">
            {cart.length} 項 · NT${totalAmount}
          </span>
          <button
            onClick={() => navigate("/cart")}
            className="btn-press ml-auto h-16 px-[34px] bg-clay text-paper text-[26px]"
          >
            查看清單
          </button>
        </div>
      </div>
    </div>
  );
}

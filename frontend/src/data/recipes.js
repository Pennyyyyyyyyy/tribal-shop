// 食譜資料：三種「馬告 × 商品」推薦（前端靜態文案／圖）
export const RECIPES = {
  coffee: {
    key: "coffee",
    category: "咖啡",
    title: "馬告咖啡",
    dishPhoto: "/photo/馬告咖啡.png",
    recipePhoto: "/recipe/馬告咖啡食譜.png",
    bg: "from-amber-700 to-amber-900",
    description:
      "在熱咖啡中加入 3–4 粒壓裂的馬告，帶來山林檸檬與胡椒的香氣，喚醒味蕾的清新層次。",
  },
  tea: {
    key: "tea",
    category: "冬瓜茶",
    title: "馬告冬瓜茶",
    dishPhoto: "/photo/馬告冬瓜茶.png",
    recipePhoto: "/recipe/馬告冬瓜茶食譜.png",
    bg: "from-emerald-600 to-emerald-800",
    description:
      "冬瓜茶冰鎮後加入少許現磨馬告，甘甜之中帶有柑橘氣息，是部落夏日的清涼祕方。",
  },
  noodle: {
    key: "noodle",
    category: "泡麵",
    title: "馬告炒泡麵",
    dishPhoto: "/photo/馬告炒泡麵.png",
    recipePhoto: "/recipe/馬告炒泡麵食譜.png",
    bg: "from-rose-600 to-rose-800",
    description:
      "泡麵瀝乾後下鍋爆香馬告與蒜末，拌入醬汁快炒，花椒般的香氣讓平凡泡麵華麗升級。",
  },
};

// 偵測購物車內是否有對應商品類別
export function detectCategory(cart) {
  const names = cart.map((i) => i.name);
  return {
    hasCoffee: names.some((n) => n.includes("咖啡")),
    hasTea: names.some((n) => n.includes("冬瓜")),
    hasNoodle: names.some((n) => /麵|米粉/.test(n)),
    hasMakau: names.some((n) => n.includes("馬告")),
  };
}

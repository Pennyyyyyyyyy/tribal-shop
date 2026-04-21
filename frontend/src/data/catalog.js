export const CATEGORIES = [
  { key: "all", label: "全部" },
  { key: "snack", label: "零食" },
  { key: "noodle", label: "泡麵" },
  { key: "drink", label: "飲品" },
  { key: "specialty", label: "特色商品" },
];

export const CATALOG = [
  {
    name: "多力多滋（芝士）",
    price: 49,
    category: "snack",
    photo: "/photo/多力多滋（芝士）.png",
  },
  {
    name: "多力多滋（黃金起司）",
    price: 49,
    category: "snack",
    photo: "/photo/多力多滋（黃金起司）.png",
  },
  {
    name: "統一牛肉麵",
    price: 32,
    category: "noodle",
    photo: "/photo/統一牛肉麵.png",
  },
  {
    name: "統一米粉（肉燥）",
    price: 30,
    category: "noodle",
    photo: "/photo/統一米粉（肉燥）.png",
  },
  {
    name: "維力炸醬麵",
    price: 30,
    category: "noodle",
    photo: "/photo/維力炸醬麵.png",
  },
  {
    name: "咖啡粉",
    price: 45,
    category: "drink",
    photo: "/photo/咖啡粉.png",
  },
  {
    name: "冬瓜磚",
    price: 25,
    category: "drink",
    photo: "/photo/冬瓜磚.png",
  },
  {
    name: "馬告（山胡椒）",
    price: 80,
    category: "specialty",
    photo: "/photo/馬告.png",
  },
];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function catalogToCartItem(item, quantity = 1) {
  return {
    id: Math.abs(hashCode(item.name)) % 100000,
    name: item.name,
    price: item.price,
    image_url: item.photo,
    quantity,
  };
}

export function findProduct(name) {
  return CATALOG.find((p) => p.name === name);
}

export function getNoodleProducts() {
  return CATALOG.filter((p) => p.category === "noodle");
}

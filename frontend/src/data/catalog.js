// 把從 /api/products 取得的 supabase 商品轉成購物車 item
export function productToCartItem(product, quantity = 1) {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    image_url: product.image_url,
    quantity,
  };
}

export function findProductByName(products, name) {
  if (!products || !name) return null;
  const exact = products.find((p) => p.name === name);
  if (exact) return exact;
  return products.find((p) => p.name?.includes(name)) || null;
}

// 找馬告本尊（排除馬告咖啡等衍生品名，雖然目前 supabase 沒有但保險）
export function findMakauProduct(products) {
  if (!products) return null;
  return (
    products.find((p) => p.name === "馬告") ||
    products.find(
      (p) => p.name?.includes("馬告") && !/咖啡|茶|麵/.test(p.name)
    ) ||
    null
  );
}

export function getNoodleProducts(products) {
  if (!products) return [];
  return products.filter((p) => (p.category || "").trim() === "泡麵");
}

export function getMakauCartItem(products) {
  const makau = findMakauProduct(products);
  return makau ? productToCartItem(makau) : null;
}

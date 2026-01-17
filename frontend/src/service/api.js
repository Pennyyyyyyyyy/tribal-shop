// 定義後端網址 (如果以後上線，只要改這裡就好)
const API_URL = "http://127.0.0.1:8000"; 
const UPLOADS_URL = `${API_URL}/uploads`; // 用來顯示圖片的基礎路徑

// 1. 取得商品列表
export const fetchProducts = async () => {
  try {
    const response = await fetch(`${API_URL}/api/products`);
    if (!response.ok) throw new Error("無法取得商品資料");
    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return [];
  }
};

// 2. 送出結帳請求 (包含圖片上傳)
export const submitCheckout = async (orderData, imageFile) => {
  // 因為要上傳圖片，必須使用 FormData
  const formData = new FormData();
  
  // 後端要求 'data' 欄位必須是 JSON 字串
  formData.append('data', JSON.stringify(orderData));
  
  // 如果有圖片才放進去
  if (imageFile) {
    formData.append('image', imageFile);
  }

  try {
    const response = await fetch(`${API_URL}/api/checkout/`, {
      method: "POST",
      body: formData, // fetch 會自動設定 Content-Type 為 multipart/form-data
    });
    
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "結帳失敗");
    return result;
  } catch (error) {
    console.error("Checkout Error:", error);
    throw error;
  }
};

// 匯出圖片路徑 helper，方便元件使用
export const getImageUrl = (path) => {
  if (!path) return "/default-placeholder.png"; // 預設圖
  if (path.startsWith("http")) return path;
  // 如果後端回傳的是相對路徑 (ex: uploads/images/xxx.jpg)，加上 Domain
  return `${API_URL}/${path}`;
};
// 商品辨識訓練照片業務邏輯。
// 流程：LINE 收到店長傳的圖 → 找目前正在補圖的商品 → 找 image1..4 第一個空位 →
//       下載 LINE 圖 → 上傳到 products bucket → 更新 training_data 對應欄位。
import * as supabase from "../lib/supabase.js";
import * as line from "../lib/line.js";

export async function getOrCreateForProduct(env, productId) {
    const existing = (await supabase.query(env, `/rest/v1/training_data?product_id=eq.${productId}`))[0];
    if (existing) return existing;
    return supabase.postReturn(env, "/rest/v1/training_data", {
        product_id: productId,
        english_name: "PENDING",
    });
}

// 依 image1..4 順序，找第一個還沒填的欄位；四張都滿了回 null。
export function nextEmptyImageField(trainData) {
    if (!trainData.image1) return "image1";
    if (!trainData.image2) return "image2";
    if (!trainData.image3) return "image3";
    if (!trainData.image4) return "image4";
    return null;
}

// 從 LINE 下載圖片、上傳到 products bucket、update 指定的 training_data row。
// trainDataId 由 caller 傳入（通常 caller 已經 getOrCreateForProduct 過），避免多打一次 query。
// channel: 'manager' | 'consignor' —— messageId 是 channel-scoped，要用對的 token 下載。
export async function attachImage(env, channel, { messageId, productId, trainDataId, field }) {
    const blob = await line.fetchContent(env, channel, messageId);
    const path = `${productId}/${field}.jpg`;
    const url = await supabase.uploadPublic(env, "products", path, blob, "image/jpeg", true);
    await supabase.patch(env, `/rest/v1/training_data?id=eq.${trainDataId}`, { [field]: url });
    return url;
}

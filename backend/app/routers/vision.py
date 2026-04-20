"""
商品影像辨識 API — 接收前端拍攝的影像，回傳辨識結果。
"""

import io
from fastapi import APIRouter, UploadFile, File
from PIL import Image

from app.ai.predict import predict
from app.database import get_db

router = APIRouter()

# 英文 label → 中文商品資訊（預設價格 / emoji）
LABEL_MAP = {
    "alley_dry_noodles _sesame_flavor": {"name": "巷口乾麵（芝麻）", "price": 35, "image": "🍜"},
    "doritos_flamin_hot":              {"name": "多力多滋（火辣）", "price": 49, "image": "🌶️"},
    "doritos_golden_cheese":           {"name": "多力多滋（黃金起司）", "price": 49, "image": "🧀"},
    "doritos_nacho_cheese":            {"name": "多力多滋（芝士）", "price": 49, "image": "🧀"},
    "doritos_sichuan_chicken":         {"name": "多力多滋（川辣雞）", "price": 49, "image": "🌶️"},
    "ecoplanet_dishwashing_sensitive": {"name": "環保星球洗碗精", "price": 89, "image": "🧴"},
    "laiike_kimchi":                   {"name": "來一客（韓式泡菜）", "price": 30, "image": "🍜"},
    "laiike_seafood":                  {"name": "來一客（鮮蝦魚板）", "price": 30, "image": "🍜"},
    "laoguo_sesame_noodles":           {"name": "老郭麻醬麵", "price": 35, "image": "🍜"},
    "maobao_soda_dishwashing":         {"name": "毛寶蘇打洗碗精", "price": 79, "image": "🧴"},
    "paos_dishwashing":                {"name": "泡舒洗碗精", "price": 69, "image": "🧴"},
    "paos_dishwashing_lemon":          {"name": "泡舒洗碗精（檸檬）", "price": 69, "image": "🧴"},
    "taisun_canola_oil":               {"name": "泰山芥花油", "price": 159, "image": "🫒"},
    "tongyi_bakkutteh":                {"name": "統一肉骨茶麵", "price": 32, "image": "🍜"},
    "tongyi_beef":                     {"name": "統一牛肉麵", "price": 32, "image": "🍜"},
    "tongyi_beef_bowl":                {"name": "統一滿漢大碗（牛肉）", "price": 45, "image": "🍜"},
    "tongyi_braised_pork":             {"name": "統一滷肉燥麵", "price": 32, "image": "🍜"},
    "tongyi_mifen_meat":               {"name": "統一米粉（肉燥）", "price": 30, "image": "🍜"},
    "tongyi_shrimp":                   {"name": "統一鮮蝦麵", "price": 32, "image": "🍜"},
    "weilih_zhajiang":                 {"name": "維力炸醬麵", "price": 30, "image": "🍜"},
    "wonda_black":                     {"name": "Wonda黑咖啡", "price": 25, "image": "☕"},
    "yidu_zan_grilled_pork_noodles":   {"name": "一度贊（炙燒豬排）", "price": 39, "image": "🍜"},
}


@router.post("/detect-product")
async def detect_product(image: UploadFile = File(...)):
    """接收一張圖片，回傳前三名辨識到的商品資訊（Top-3）。"""

    contents = await image.read()
    pil_image = Image.open(io.BytesIO(contents)).convert("RGB")

    # 現在 predict 會回傳一個 list，包含 3 個 dict
    top_results = predict(pil_image)
    
    final_products = []
    conn = get_db()

    for res in top_results:
        label = res["class"]
        confidence = res["confidence"]

        # 1. 取得 mapping 資訊
        mapped = LABEL_MAP.get(label, {"name": label, "price": 0, "image": "📦"})
        product_name = mapped["name"]

        # 2. 嘗試從資料庫取得資訊
        db_row = conn.execute(
            "SELECT id, name, price, stock, image_url FROM products WHERE name = ?",
            (product_name,),
        ).fetchone()

        if db_row:
            product_info = {
                "id": db_row["id"],
                "name": db_row["name"],
                "price": db_row["price"],
                "stock": db_row["stock"],
                "image": mapped["image"],
                "image_url": db_row["image_url"],
                "confidence": confidence,
            }
        else:
            # 資料庫沒有 → 使用 mapping 預設值
            product_info = {
                "id": abs(hash(label)) % 100000,
                "name": product_name,
                "price": mapped["price"],
                "image": mapped["image"],
                "confidence": confidence,
            }
        
        final_products.append(product_info)

    conn.close()

    return {
        "status": "success",
        "predictions": final_products  # 回傳包含三個預測結果的列表
    }

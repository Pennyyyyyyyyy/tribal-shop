from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.database import get_db
from app.services.line_service import send_line_notification
import json
import shutil
import uuid
import os
from datetime import datetime

router = APIRouter(prefix="/api/checkout", tags=["Checkout"])

@router.post("/")
async def checkout(
    cart_items: str = Form(...),
    total_amount: int = Form(...),
    photo: UploadFile = File(None),
):
    # 1. 解析購物車
    try:
        items = json.loads(cart_items)
    except Exception:
        raise HTTPException(status_code=400, detail="cart_items JSON 格式錯誤")

    # 2. 儲存照片
    image_path = ""
    if photo:
        file_id = str(uuid.uuid4())
        os.makedirs("uploads/images", exist_ok=True)
        image_path = f"uploads/images/{file_id}_{photo.filename}"
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)

    conn = get_db()
    cursor = conn.cursor()

    # 5. 扣庫存 & 檢查庫存水位
    items_str = json.dumps(items, ensure_ascii=False)
    low_stock_warnings = []

    for item in items:
        cursor.execute(
            "UPDATE products SET stock = stock - ? WHERE name = ?",
            (item.get("quantity", 1), item["name"]),
        )
        prod = cursor.execute(
            "SELECT stock FROM products WHERE name = ?", (item["name"],)
        ).fetchone()
        if prod and prod["stock"] < 5:
            low_stock_warnings.append(f"{item['name']} (剩 {prod['stock']} 個)")

    # 6. 建立訂單紀錄
    user_name = "族人"
    cursor.execute(
        """INSERT INTO orders (type, user_name, items, total_amount, is_recognized, checkout_image_path)
           VALUES (?, ?, ?, ?, ?, ?)""",
        ("CREDIT", user_name, items_str, total_amount, True, image_path),
    )

    conn.commit()
    conn.close()

    # 7. 組合商品明細
    detail_lines = [f"  {it['name']} x{it.get('quantity',1)}" for it in items]
    detail_str = "\n".join(detail_lines)

    # 8. 組合 LINE 通知訊息
    msg = (
        f"【結帳通知】\n"
        f"類型: 族人賒帳\n"
        f"商品:\n{detail_str}\n"
        f"總金額: ${total_amount}"
    )
    send_line_notification(msg, image_path=image_path if image_path else None)

    # 9. 發送庫存警報
    if low_stock_warnings:
        warn_msg = "🚨【庫存告急】請補貨：\n" + "\n".join(low_stock_warnings)
        send_line_notification(warn_msg)

    return {"status": "success", "message": "結帳完成"}

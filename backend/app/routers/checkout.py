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
    data: str = Form(...),            # 前端把 JSON 轉字串傳進來
    image: UploadFile = File(None)    # 結帳當下的照片
):
    # 1. 解析資料
    try:
        order_data = json.loads(data)
    except:
        raise HTTPException(status_code=400, detail="JSON 格式錯誤")

    # 2. 儲存圖片 (作為結帳證明)
    image_path = ""
    if image:
        file_id = str(uuid.uuid4())
        os.makedirs("uploads/images", exist_ok=True)
        image_path = f"uploads/images/{file_id}_{image.filename}"
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

    conn = get_db()
    cursor = conn.cursor()

    # 3. 處理「賒帳」邏輯
    current_debt = 0
    if order_data['type'] == 'CREDIT':
        user_name = order_data.get('user_name')
        if not user_name:
            raise HTTPException(status_code=400, detail="賒帳模式必須輸入姓名")
        
        # 找找看有沒有這個人
        member = cursor.execute("SELECT * FROM members WHERE name = ?", (user_name,)).fetchone()
        
        if member:
            # 老客戶：原本欠款 + 這次金額
            new_debt = member['total_debt'] + order_data['total_amount']
            cursor.execute("UPDATE members SET total_debt = ? WHERE name = ?", (new_debt, user_name))
            current_debt = new_debt
        else:
            # 新客戶：建立資料
            cursor.execute("INSERT INTO members (name, total_debt) VALUES (?, ?)", (user_name, order_data['total_amount']))
            current_debt = order_data['total_amount']

    # 4. 扣庫存 & 檢查庫存水位
    items_str = json.dumps(order_data['items'], ensure_ascii=False)
    low_stock_warnings = []

    for item in order_data['items']:
        # 扣掉庫存
        cursor.execute("UPDATE products SET stock = stock - ? WHERE name = ?", (item['quantity'], item['name']))
        
        # 檢查剩餘數量 (庫存提醒需求)
        prod = cursor.execute("SELECT stock FROM products WHERE name = ?", (item['name'],)).fetchone()
        if prod and prod['stock'] < 5:
            low_stock_warnings.append(f"{item['name']} (剩 {prod['stock']} 個)")

    # 5. 建立訂單紀錄 (包含 is_recognized 用來之後算準確率)
    cursor.execute('''
        INSERT INTO orders (type, user_name, items, total_amount, is_recognized, checkout_image_path)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        order_data['type'], 
        order_data.get('user_name', 'Guest'), 
        items_str, 
        order_data['total_amount'], 
        order_data['is_recognized'], # Yes/No 存這裡
        image_path
    ))

    conn.commit()
    conn.close()

    # 6. 發送 LINE 通知 (對應需求：店長收到通知)
    msg = f"【結帳通知】\n類型: {order_data['type']}\n總金額: ${order_data['total_amount']}"
    if order_data['type'] == 'CREDIT':
        msg += f"\n族人: {order_data['user_name']}\n目前累積欠款: ${current_debt}"
    
    send_line_notification(msg, image_path if image_path else None)

    # 7. 發送庫存警報
    if low_stock_warnings:
        warn_msg = "🚨【庫存告急】請補貨：\n" + "\n".join(low_stock_warnings)
        send_line_notification(warn_msg)

    return {"status": "success", "message": "結帳完成", "current_debt": current_debt}
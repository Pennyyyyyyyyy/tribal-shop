import os
import uuid
import shutil
import sqlite3
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles # 記得導入這個
import whisper

# --- 1. 初始化與設定 ---
app = FastAPI()
# 建議同學第一次跑的時候要連網，Whisper 會下載模型檔 (約 140MB)
model = whisper.load_model("base") 

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "checkout_system.db"
UPLOAD_DIR = "uploads"

# --- 2. 初始化功能 ---
def init_db():
    for sub in ["images", "audio", "videos"]:
        os.makedirs(os.path.join(UPLOAD_DIR, sub), exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, price INTEGER)")
    cursor.execute("CREATE TABLE IF NOT EXISTS inventory (product_id INTEGER PRIMARY KEY, stock_count INTEGER)")
    cursor.execute('''CREATE TABLE IF NOT EXISTS pending_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT, recognized_text TEXT, image_path TEXT, audio_path TEXT, video_path TEXT, status TEXT DEFAULT 'pending'
    )''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS final_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, pending_id INTEGER, total_amount INTEGER, confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    cursor.execute("INSERT OR IGNORE INTO products VALUES (1, '可樂', 25), (2, '巧克力', 35)")
    cursor.execute("INSERT OR IGNORE INTO inventory VALUES (1, 100), (2, 50)")
    conn.commit()
    conn.close()

init_db()

# 【重要】這行讓同學可以透過瀏覽器看自己電腦裡的檔案
# 網址格式：http://127.0.0.1:8000/uploads/images/檔名.jpg
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- 3. API 實作 ---

@app.post("/submit-checkout")
async def submit_checkout(
    image: UploadFile = File(...),
    audio: UploadFile = File(...),
    video: UploadFile = File(...),
    user_id: str = Form("user_01")
):
    file_id = str(uuid.uuid4())
    img_path = f"{UPLOAD_DIR}/images/{file_id}_{image.filename}"
    aud_path = f"{UPLOAD_DIR}/audio/{file_id}_{audio.filename}"
    vid_path = f"{UPLOAD_DIR}/videos/{file_id}_{video.filename}"

    with open(img_path, "wb") as f: shutil.copyfileobj(image.file, f)
    with open(aud_path, "wb") as f: shutil.copyfileobj(audio.file, f)
    with open(vid_path, "wb") as f: shutil.copyfileobj(video.file, f)

    result = model.transcribe(aud_path)
    text = result["text"]

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO pending_transactions (user_id, recognized_text, image_path, audio_path, video_path) VALUES (?,?,?,?,?)",
        (user_id, text, img_path, aud_path, vid_path)
    )
    pending_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {"message": "已送出審核", "pending_id": pending_id, "recognized_text": text}

@app.post("/approve-transaction/{pending_id}")
async def approve_transaction(pending_id: int):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM pending_transactions WHERE id = ?", (pending_id,))
        row = cursor.fetchone()
        if not row or row['status'] != 'pending':
            raise HTTPException(status_code=404, detail="找不到訂單或已處理")

        cursor.execute("SELECT * FROM products")
        products = cursor.fetchall()
        target = next((p for p in products if p['name'] in row['recognized_text']), None)

        if not target:
            raise HTTPException(status_code=400, detail="無法辨識商品內容")

        cursor.execute("UPDATE inventory SET stock_count = stock_count - 1 WHERE product_id = ?", (target['id'],))
        cursor.execute("INSERT INTO final_transactions (pending_id, total_amount) VALUES (?, ?)", (pending_id, target['price']))
        cursor.execute("UPDATE pending_transactions SET status = 'approved' WHERE id = ?", (pending_id,))
        conn.commit()
        return {"status": "success", "msg": f"已扣除{target['name']}庫存", "price": target['price']}
    finally:
        conn.close()

@app.get("/check-status")
async def check_status():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        inv = cursor.execute("SELECT p.name, i.stock_count FROM inventory i JOIN products p ON i.product_id = p.id").fetchall()
        pending = cursor.execute("SELECT * FROM pending_transactions ORDER BY id DESC").fetchall()
        return {"inventory": [dict(r) for r in inv], "pending": [dict(r) for r in pending]}
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
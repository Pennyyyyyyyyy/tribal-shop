import sqlite3
import os

DB_PATH = "tribal_shop.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. 商品表 (含圖片連結)
    cursor.execute('''CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        price INTEGER,
        stock INTEGER,
        image_url TEXT
    )''')

    # 2. 會員表 (紀錄族人欠款)
    cursor.execute('''CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        total_debt INTEGER DEFAULT 0
    )''')

    # 3. 訂單表
    cursor.execute('''CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT, -- 'LINEPAY' or 'CREDIT'
        user_name TEXT,
        items TEXT, -- 存 JSON 字串
        total_amount INTEGER,
        is_recognized BOOLEAN,
        checkout_image_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # 預設資料
    cursor.execute("INSERT OR IGNORE INTO products (name, price, stock) VALUES ('小米酒', 200, 10)")
    cursor.execute("INSERT OR IGNORE INTO products (name, price, stock) VALUES ('手工餅乾', 50, 30)")
    
    conn.commit()
    conn.close()
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

    # 3. 商品辨識圖片表 (每個商品最多 4 張)
    cursor.execute('''CREATE TABLE IF NOT EXISTS product_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT,
        image_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_name) REFERENCES products(name)
    )''')

    # 4. 訂單表
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
    
    # 預設資料（對應 AI 辨識模型的 22 種商品）
    default_products = [
        ("巷口乾麵（芝麻）", 35, 30),
        ("多力多滋（火辣）", 49, 30),
        ("多力多滋（黃金起司）", 49, 30),
        ("多力多滋（芝士）", 49, 30),
        ("多力多滋（川辣雞）", 49, 30),
        ("環保星球洗碗精", 89, 20),
        ("來一客（韓式泡菜）", 30, 30),
        ("來一客（鮮蝦魚板）", 30, 30),
        ("老郭麻醬麵", 35, 30),
        ("毛寶蘇打洗碗精", 79, 20),
        ("泡舒洗碗精", 69, 20),
        ("泡舒洗碗精（檸檬）", 69, 20),
        ("泰山芥花油", 159, 15),
        ("統一肉骨茶麵", 32, 30),
        ("統一牛肉麵", 32, 30),
        ("統一滿漢大碗（牛肉）", 45, 30),
        ("統一滷肉燥麵", 32, 30),
        ("統一米粉（肉燥）", 30, 30),
        ("統一鮮蝦麵", 32, 30),
        ("維力炸醬麵", 30, 30),
        ("Wonda黑咖啡", 25, 40),
        ("一度贊（炙燒豬排）", 39, 30),
    ]
    for name, price, stock in default_products:
        cursor.execute(
            "INSERT OR IGNORE INTO products (name, price, stock) VALUES (?, ?, ?)",
            (name, price, stock),
        )

    # 預設會員
    cursor.execute("INSERT OR IGNORE INTO members (name, total_debt) VALUES ('宜霈', 0)")
    
    conn.commit()
    conn.close()
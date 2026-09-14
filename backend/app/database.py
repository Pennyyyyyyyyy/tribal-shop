"""
資料庫連線層 — 優先連 Supabase Postgres；連不上時 fallback 本地 SQLite cache。

兩種 backend 都經由 DBConnection / DBCursor 包一層，對外提供：
  - conn.execute(sql, params)  /  cursor.execute(sql, params)
  - fetchone() / fetchall() 回傳 dict
  - SQL 統一用 %s placeholder，wrapper 會在 SQLite 時換成 ?

啟動時：
  1. 偵測 backend（連得上 Supabase 就用 postgres）
  2. 一律建好本地 SQLite schema（供未來 fallback 用）
  3. 若 backend=postgres，把 products / member 從 Supabase 快取到本地
"""

import os
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")
LOCAL_DB_PATH = "tribal_shop.db"

_backend: str | None = None  # 'postgres' 或 'sqlite'


# ══════════════════════════════════════════════════════════
#  Wrapper：統一 Postgres / SQLite 的 API
# ══════════════════════════════════════════════════════════
class DBCursor:
    def __init__(self, cur, backend: str):
        self._cur = cur
        self.backend = backend

    def execute(self, sql: str, params=()):
        if self.backend == "sqlite":
            sql = sql.replace("%s", "?")
        self._cur.execute(sql, params)
        return self

    def fetchone(self):
        row = self._cur.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self):
        return [dict(r) for r in self._cur.fetchall()]

    @property
    def rowcount(self):
        return self._cur.rowcount

    def close(self):
        self._cur.close()


class DBConnection:
    def __init__(self, conn, backend: str):
        self._conn = conn
        self.backend = backend

    def cursor(self):
        return DBCursor(self._conn.cursor(), self.backend)

    def execute(self, sql: str, params=()):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


# ══════════════════════════════════════════════════════════
#  Backend 偵測 & 連線
# ══════════════════════════════════════════════════════════
def _detect_backend() -> str:
    global _backend
    if _backend:
        return _backend
    if SUPABASE_DB_URL:
        try:
            conn = psycopg2.connect(SUPABASE_DB_URL, connect_timeout=5)
            conn.close()
            _backend = "postgres"
            print("[db] 使用 Supabase Postgres")
            return _backend
        except Exception as e:
            print(f"[db] Supabase 連線失敗，改用本地 SQLite 備援：{e}")
    _backend = "sqlite"
    print(f"[db] 使用本地 SQLite 備援（{LOCAL_DB_PATH}）")
    return _backend


def get_db() -> DBConnection:
    backend = _detect_backend()
    if backend == "postgres":
        raw = psycopg2.connect(SUPABASE_DB_URL, cursor_factory=RealDictCursor)
    else:
        raw = sqlite3.connect(LOCAL_DB_PATH)
        raw.row_factory = sqlite3.Row
    return DBConnection(raw, backend)


# ══════════════════════════════════════════════════════════
#  啟動時初始化
# ══════════════════════════════════════════════════════════
def init_db():
    backend = _detect_backend()
    # 無論走哪個 backend，本地 schema 都建好 — 供未來斷線 fallback
    _init_sqlite_schema()
    if backend == "postgres":
        try:
            _sync_cache_from_supabase()
        except Exception as e:
            print(f"[db] 啟動時同步快取失敗（不影響正常使用）：{e}")


def _init_sqlite_schema():
    """本地 SQLite schema 對齊 Supabase。"""
    conn = sqlite3.connect(LOCAL_DB_PATH)
    cur = conn.cursor()

    cur.execute('''CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        price INTEGER NOT NULL,
        stock INTEGER,
        category TEXT,
        trained INTEGER,
        image_url TEXT,
        embedding TEXT,
        label_name TEXT
    )''')

    cur.execute('''CREATE TABLE IF NOT EXISTS member (
        id INTEGER PRIMARY KEY,
        nickname TEXT UNIQUE NOT NULL,
        total_debt INTEGER DEFAULT 0
    )''')

    cur.execute('''CREATE TABLE IF NOT EXISTS credit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        transaction_id INTEGER,
        transaction_total INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    cur.execute('''CREATE TABLE IF NOT EXISTS "transaction" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identity TEXT NOT NULL,
        type TEXT NOT NULL,
        total INTEGER NOT NULL,
        item_list TEXT,
        checkout_image TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    cur.execute('''CREATE TABLE IF NOT EXISTS training_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        image1 TEXT,
        image2 TEXT,
        image3 TEXT,
        image4 TEXT,
        english_name TEXT
    )''')

    cur.execute('''CREATE TABLE IF NOT EXISTS stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        restock_date TEXT NOT NULL,
        expire_month TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    cur.execute('''CREATE TABLE IF NOT EXISTS announcement (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT,
        upload_time TEXT,
        removal_time TEXT
    )''')

    cur.execute('''CREATE TABLE IF NOT EXISTS users (
        line_id TEXT PRIMARY KEY,
        nickname TEXT,
        role TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_command TEXT,
        temp_data TEXT
    )''')

    conn.commit()
    conn.close()


def _sync_cache_from_supabase():
    """啟動時把 Supabase 的 products / member 快取到本地 SQLite。"""
    sup = psycopg2.connect(SUPABASE_DB_URL, cursor_factory=RealDictCursor)
    sup_cur = sup.cursor()

    sup_cur.execute(
        "SELECT id, name, price, stock, category, trained, image_url, label_name "
        "FROM products"
    )
    products = sup_cur.fetchall()

    sup_cur.execute("SELECT id, nickname, total_debt FROM member")
    members = sup_cur.fetchall()

    sup_cur.close()
    sup.close()

    local = sqlite3.connect(LOCAL_DB_PATH)
    cur = local.cursor()

    cur.execute("DELETE FROM products")
    for p in products:
        trained_val = None if p["trained"] is None else (1 if p["trained"] else 0)
        cur.execute(
            "INSERT INTO products (id, name, price, stock, category, trained, image_url, label_name) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (p["id"], p["name"], p["price"], p["stock"], p["category"],
             trained_val, p["image_url"], p["label_name"]),
        )

    cur.execute("DELETE FROM member")
    for m in members:
        cur.execute(
            "INSERT INTO member (id, nickname, total_debt) VALUES (?, ?, ?)",
            (m["id"], m["nickname"], m["total_debt"]),
        )

    local.commit()
    local.close()
    print(f"[db] 已同步 {len(products)} 筆 products / {len(members)} 筆 member 到本地 cache")

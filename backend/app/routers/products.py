from fastapi import APIRouter
from app.database import get_db

router = APIRouter(prefix="/api/products", tags=["Products"])

@router.get("/")
def get_products():
    conn = get_db()
    # 抓取所有商品資料回傳給前端
    products = conn.execute("SELECT id, name, price, stock, image_url FROM products").fetchall()
    conn.close()
    return [dict(p) for p in products]
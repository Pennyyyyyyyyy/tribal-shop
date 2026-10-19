from fastapi import APIRouter
from app.database import get_db

router = APIRouter(prefix="/api/products", tags=["Products"])


@router.get("/")
def get_products():
    conn = get_db()
    products = conn.execute(
        "SELECT id, name, price, stock, image_url, category FROM products ORDER BY id"
    ).fetchall()
    conn.close()
    return products

import io
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, UploadFile, File
from PIL import Image
from dotenv import load_dotenv

from app.ai.predict import get_embedding

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

router = APIRouter()

DB_CONFIG = os.getenv("SUPABASE_DB_URL")


def get_db():
    return psycopg2.connect(DB_CONFIG)

@router.post("/detect-product")
async def detect_product(image: UploadFile = File(...)):
    contents = await image.read()
    pil_image = Image.open(io.BytesIO(contents)).convert("RGB")

    # 1. embedding
    query_embedding = get_embedding(pil_image)

    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # 2. vector 轉換
        vector_str = "[" + ",".join(map(str, query_embedding)) + "]"

        cur.execute(
            """
            SELECT id, name, price, stock, image_url,
                   (embedding <=> %s::vector) as distance
            FROM products
            ORDER BY distance ASC
            LIMIT 3
            """,
            (vector_str,)
        )

        db_rows = cur.fetchall()

        response_products = []
        for row in db_rows:
            confidence = 1 - float(row['distance'])

            response_products.append({
                "id": row["id"],
                "name": row["name"],
                "price": row["price"],
                "image_url": row["image_url"],
                "confidence": max(0, confidence)
            })

    finally:
        cur.close()
        conn.close()

    return {"status": "success", "predictions": response_products}
@router.get("/test-db")
def test_db():
    try:
        print(DB_CONFIG)
        conn = psycopg2.connect(DB_CONFIG)
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.fetchone()

        cur.close()
        conn.close()

        return {"status": "success", "message": "資料庫連線成功"}
    
    except Exception as e:
        return {"status": "error", "message": str(e)}
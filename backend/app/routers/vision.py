import io
import os
import psycopg2

from pathlib import Path
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image

from app.ai.predict import get_embedding


router = APIRouter()


# ============================================================
# .env
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)

DB_CONFIG = os.getenv("DATABASE_URL")


# ============================================================
# Database Connection
# ============================================================

def get_db():

    if not DB_CONFIG:
        raise RuntimeError(
            "找不到 DATABASE_URL，請檢查 backend/.env"
        )

    conn = psycopg2.connect(
        DB_CONFIG,
        sslmode="require"
    )

    print("資料庫連線成功")

    return conn


# ============================================================
# Vision - Detect Product
# ============================================================

@router.post("/detect-product")
async def detect_product(
    image: UploadFile = File(...)
):

    # --------------------------------------------------------
    # 1. 讀取圖片
    # --------------------------------------------------------

    try:
        contents = await image.read()

        pil_image = Image.open(
            io.BytesIO(contents)
        ).convert("RGB")

    except Exception as e:

        raise HTTPException(
            status_code=400,
            detail=f"圖片讀取失敗: {str(e)}"
        )


    # --------------------------------------------------------
    # 2. 圖片轉 embedding
    # --------------------------------------------------------

    try:
        query_embedding = get_embedding(
            pil_image
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Embedding 產生失敗: {str(e)}"
        )


    # pgvector 接受：
    #
    # [0.1,0.2,0.3,...]
    #
    vector_str = (
        "["
        + ",".join(
            map(
                str,
                query_embedding
            )
        )
        + "]"
    )


    # --------------------------------------------------------
    # 3. 連接資料庫
    # --------------------------------------------------------

    conn = None
    cur = None

    try:

        conn = get_db()

        cur = conn.cursor(
            cursor_factory=RealDictCursor
        )


        # ====================================================
        # 4. 找 Top 3 不同商品
        #
        # product_embeddings：
        #
        # 同一商品可能有很多不同角度的 embedding。
        #
        # DISTINCT ON(label_name)
        # → 每個商品只留 similarity 最高的一張
        #
        # 最後再取整體 Top 3。
        # ====================================================

        cur.execute(
            """
            SELECT
                label_name,
                image_name,
                distance
            FROM (
                SELECT DISTINCT ON (label_name)
                    label_name,
                    image_name,
                    embedding <=> %s::vector AS distance
                FROM product_embeddings
                ORDER BY
                    label_name,
                    embedding <=> %s::vector ASC
            ) AS best_per_label
            ORDER BY distance ASC
            LIMIT 3
            """,
            (
                vector_str,
                vector_str
            )
        )

        matches = cur.fetchall()


        # ----------------------------------------------------
        # 沒有 embedding
        # ----------------------------------------------------

        if not matches:

            return {
                "status": "error",
                "message":
                    "product_embeddings 沒有可用資料"
            }


        predictions = []


        # ====================================================
        # 5. 用 label_name 去 products 找商品資料
        # ====================================================

        for match in matches:

            label_name = match[
                "label_name"
            ]

            distance = float(
                match["distance"]
            )

            # cosine distance
            # similarity = 1 - distance
            similarity = (
                1.0 - distance
            )


            # ------------------------------------------------
            # 查 products
            # ------------------------------------------------

            cur.execute(
                """
                SELECT
                    id,
                    name,
                    price,
                    stock,
                    image_url,
                    label_name
                FROM products
                WHERE label_name = %s
                LIMIT 1
                """,
                (
                    label_name,
                )
            )

            product = cur.fetchone()


            # ------------------------------------------------
            # product_embeddings 有 label
            # 但 products 沒有
            # ------------------------------------------------

            if not product:

                print(
                    "products 找不到 label_name:",
                    label_name
                )

                continue


            # ------------------------------------------------
            # 組成原本 ScanPage 要的 prediction
            # ------------------------------------------------

            prediction = {

                "id":
                    product["id"],

                "name":
                    product["name"],

                "price":
                    product["price"],

                "stock":
                    product["stock"],

                "image_url":
                    product["image_url"],

                "label_name":
                    product["label_name"],

                "confidence":
                    similarity,

                "matched_image":
                    match["image_name"]
            }


            predictions.append(
                prediction
            )


        # ====================================================
        # 6. 所有 label 都沒有對應 products
        # ====================================================

        if not predictions:

            return {
                "status": "error",
                "message":
                    "辨識到商品，但 products 中找不到對應 label_name"
            }


        # ====================================================
        # 7. 回傳舊前端格式
        #
        # ScanPage 原本就是：
        #
        # data.predictions.map(...)
        #
        # 所以前端完全不用改
        # ====================================================

        return {
            "status": "success",
            "predictions": predictions
        }


    except psycopg2.Error as e:

        print(
            "Database Error:",
            e
        )

        raise HTTPException(
            status_code=500,
            detail=f"資料庫錯誤: {str(e)}"
        )


    except Exception as e:

        print(
            "Detect Product Error:",
            e
        )

        raise HTTPException(
            status_code=500,
            detail=f"辨識失敗: {str(e)}"
        )


    finally:

        if cur:
            cur.close()

        if conn:
            conn.close()


# ============================================================
# Test Database
# ============================================================

@router.get("/test-db")
def test_db():

    conn = None
    cur = None

    try:

        conn = get_db()

        cur = conn.cursor(
            cursor_factory=RealDictCursor
        )


        # ----------------------------------------------------
        # products 數量
        # ----------------------------------------------------

        cur.execute(
            """
            SELECT COUNT(*) AS count
            FROM products
            """
        )

        products_count = cur.fetchone()[
            "count"
        ]


        # ----------------------------------------------------
        # embeddings 數量
        # ----------------------------------------------------

        cur.execute(
            """
            SELECT COUNT(*) AS count
            FROM product_embeddings
            """
        )

        embeddings_count = cur.fetchone()[
            "count"
        ]


        # ----------------------------------------------------
        # embedding 類別數
        # ----------------------------------------------------

        cur.execute(
            """
            SELECT COUNT(
                DISTINCT label_name
            ) AS count
            FROM product_embeddings
            """
        )

        embedding_classes = cur.fetchone()[
            "count"
        ]


        # ----------------------------------------------------
        # products label 類別數
        # ----------------------------------------------------

        cur.execute(
            """
            SELECT COUNT(
                DISTINCT label_name
            ) AS count
            FROM products
            WHERE label_name IS NOT NULL
            """
        )

        product_classes = cur.fetchone()[
            "count"
        ]


        return {

            "status":
                "success",

            "database":
                "connected",

            "products":
                products_count,

            "product_embeddings":
                embeddings_count,

            "embedding_classes":
                embedding_classes,

            "product_classes":
                product_classes
        }


    except Exception as e:

        print(
            "Test DB Error:",
            e
        )

        return {
            "status":
                "error",

            "message":
                str(e)
        }


    finally:

        if cur:
            cur.close()

        if conn:
            conn.close()
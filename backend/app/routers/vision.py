import io
import os
import requests
import psycopg2

from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, UploadFile, File
from PIL import Image
from dotenv import load_dotenv

from app.ai.predict import get_embedding


router = APIRouter()

load_dotenv()

DB_CONFIG = os.getenv("DATABASE_URL")


def get_db():

    if not DB_CONFIG:
        raise RuntimeError(
            "找不到 DATABASE_URL，請檢查 .env"
        )

    return psycopg2.connect(
        print('success'),
        DB_CONFIG,
        sslmode="require"
    )



@router.post("/detect-product")
async def detect_product(
    image: UploadFile = File(...)
):

    contents = await image.read()

    pil_image = Image.open(
        io.BytesIO(contents)
    ).convert("RGB")


    query_embedding = get_embedding(
        pil_image
    )

    vector_str = (
        "["
        +
        ",".join(
            map(
                str,
                query_embedding
            )
        )
        +
        "]"
    )


    conn = get_db()

    cur = conn.cursor(
        cursor_factory=RealDictCursor
    )


    try:
        cur.execute(
            """
            SELECT
                id,
                label_name,
                image_name,
                embedding <=> %s::vector AS distance
            FROM product_embeddings
            ORDER BY distance ASC
            LIMIT 5
            """,
            (vector_str,)
        )

        embedding_rows = cur.fetchall()


        if not embedding_rows:

            return {
                "status": "error",
                "message": "product_embeddings 沒有資料"
            }



        best_match = embedding_rows[0]

        best_label = best_match[
            "label_name"
        ]

        similarity = (
            1
            -
            float(
                best_match["distance"]
            )
        )



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
            (best_label,)
        )

        product = cur.fetchone()


        if not product:

            return {
                "status": "error",
                "message": (
                    f"辨識到 {best_label}，"
                    "但 products 中找不到對應商品"
                )
            }


        top_matches = []

        for row in embedding_rows:

            top_matches.append({

                "label_name":
                    row["label_name"],

                "image_name":
                    row["image_name"],

                "similarity":
                    1 - float(
                        row["distance"]
                    )
            })

        return {

            "status":
                "success",

            "product": {

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
                    product["label_name"]
            },

            "recognition": {

                "label_name":
                    best_label,

                "similarity":
                    similarity,

                "matched_image":
                    best_match[
                        "image_name"
                    ]
            },

            "top_matches":
                top_matches
        }


    finally:

        cur.close()
        conn.close()


@router.post("/sync-embedding")
async def sync_embedding(
    payload: dict
):

    record = payload.get(
        "record"
    )

    if not record:

        return {
            "status": "error",
            "message": "No record found"
        }


    product_id = record.get(
        "id"
    )

    image_url = record.get(
        "image_url"
    )

    label_name = record.get(
        "label_name"
    )


    if not image_url:

        return {
            "status": "ignored",
            "message": "No image_url provided"
        }


    if not label_name:

        return {
            "status": "ignored",
            "message": "No label_name provided"
        }


    try:

        resp = requests.get(
            image_url,
            timeout=10
        )

        resp.raise_for_status()


        img = Image.open(
            io.BytesIO(
                resp.content
            )
        ).convert("RGB")


        embedding = get_embedding(
            img
        )


        vector_str = (
            "["
            +
            ",".join(
                map(
                    str,
                    embedding
                )
            )
            +
            "]"
        )


        conn = get_db()

        cur = conn.cursor()


        cur.execute(
            """
            INSERT INTO product_embeddings
            (
                label_name,
                image_name,
                embedding
            )
            VALUES
            (
                %s,
                %s,
                %s::vector
            )
            """,
            (
                label_name,
                image_url,
                vector_str
            )
        )


        conn.commit()

        cur.close()
        conn.close()


        return {

            "status":
                "success",

            "product_id":
                product_id,

            "label_name":
                label_name
        }


    except Exception as e:

        return {
            "status": "error",
            "message": str(e)
        }


# =============================
# TEST DATABASE
# =============================

@router.get("/test-db")
def test_db():

    try:

        conn = get_db()

        cur = conn.cursor()


        cur.execute(
            """
            SELECT
                COUNT(*)
            FROM product_embeddings
            """
        )


        embedding_count = (
            cur.fetchone()[0]
        )


        cur.execute(
            """
            SELECT
                COUNT(
                    DISTINCT label_name
                )
            FROM product_embeddings
            """
        )


        class_count = (
            cur.fetchone()[0]
        )


        cur.close()
        conn.close()


        return {

            "status":
                "success",

            "message":
                "資料庫連線成功",

            "embeddings":
                embedding_count,

            "classes":
                class_count
        }


    except Exception as e:

        return {
            "status": "error",
            "message": str(e)
        }
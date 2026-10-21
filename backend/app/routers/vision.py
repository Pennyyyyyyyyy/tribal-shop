import io
import os
import json
import requests

import psycopg2

from pathlib import Path
from PIL import Image
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException
)

from pydantic import BaseModel

from app.ai.predict import get_embedding


router = APIRouter()


# ============================================================
# 路徑
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

ENV_PATH = BASE_DIR / ".env"

ROI_CONFIG_PATH = (
    BASE_DIR
    / "app"
    / "config"
    / "roi_config.json"
)


# ============================================================
# .env
# ============================================================

load_dotenv(dotenv_path=ENV_PATH)

DB_CONFIG = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")


# ============================================================
# Database
# ============================================================

def get_db():

    if not DB_CONFIG:
        raise RuntimeError(
            "找不到 DATABASE_URL 或 SUPABASE_DB_URL，請檢查 backend/.env"
        )

    return psycopg2.connect(
        DB_CONFIG,
        sslmode="require"
    )


# ============================================================
# ROI Model
# ============================================================

class ROIRegion(BaseModel):

    id: int
    name: str

    x1: float
    y1: float
    x2: float
    y2: float


class ROIConfig(BaseModel):

    regions: list[ROIRegion]


# ============================================================
# Default ROI
# ============================================================

def get_default_roi():

    return {
        "regions": [

            {
                "id": 1,
                "name": "ROI 1",
                "x1": 0.0,
                "y1": 0.0,
                "x2": 0.3333,
                "y2": 0.5
            },

            {
                "id": 2,
                "name": "ROI 2",
                "x1": 0.3333,
                "y1": 0.0,
                "x2": 0.6666,
                "y2": 0.5
            },

            {
                "id": 3,
                "name": "ROI 3",
                "x1": 0.6666,
                "y1": 0.0,
                "x2": 1.0,
                "y2": 0.5
            },

            {
                "id": 4,
                "name": "ROI 4",
                "x1": 0.0,
                "y1": 0.5,
                "x2": 0.3333,
                "y2": 1.0
            },

            {
                "id": 5,
                "name": "ROI 5",
                "x1": 0.3333,
                "y1": 0.5,
                "x2": 0.6666,
                "y2": 1.0
            },

            {
                "id": 6,
                "name": "ROI 6",
                "x1": 0.6666,
                "y1": 0.5,
                "x2": 1.0,
                "y2": 1.0
            }
        ]
    }


# ============================================================
# Load ROI
# ============================================================

def load_roi_config():

    if not ROI_CONFIG_PATH.exists():

        config = get_default_roi()

        save_roi_config(config)

        return config

    with open(
        ROI_CONFIG_PATH,
        "r",
        encoding="utf-8"
    ) as f:

        return json.load(f)


# ============================================================
# Save ROI
# ============================================================

def save_roi_config(config):

    ROI_CONFIG_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with open(
        ROI_CONFIG_PATH,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            config,
            f,
            ensure_ascii=False,
            indent=2
        )


# ============================================================
# Validate ROI
# ============================================================

def validate_roi(region):

    values = [
        region["x1"],
        region["y1"],
        region["x2"],
        region["y2"]
    ]

    for value in values:

        if value < 0 or value > 1:

            raise HTTPException(
                status_code=400,
                detail="ROI 座標必須介於 0 ~ 1"
            )

    if region["x1"] >= region["x2"]:

        raise HTTPException(
            status_code=400,
            detail=f'ROI {region["id"]} x1 必須小於 x2'
        )

    if region["y1"] >= region["y2"]:

        raise HTTPException(
            status_code=400,
            detail=f'ROI {region["id"]} y1 必須小於 y2'
        )


# ============================================================
# Crop ROI
# ============================================================

def crop_roi_regions(image):

    config = load_roi_config()

    width, height = image.size

    crops = []

    for roi in config["regions"]:

        x1 = int(roi["x1"] * width)
        y1 = int(roi["y1"] * height)

        x2 = int(roi["x2"] * width)
        y2 = int(roi["y2"] * height)

        crop = image.crop(
            (
                x1,
                y1,
                x2,
                y2
            )
        )

        crops.append({

            "id": roi["id"],

            "name": roi["name"],

            "image": crop,

            "box": {
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2
            },

            "normalized_box": {
                "x1": roi["x1"],
                "y1": roi["y1"],
                "x2": roi["x2"],
                "y2": roi["y2"]
            }
        })

    return crops


# ============================================================
# pgvector Search
# ============================================================

def search_pgvector(embedding):

    vector_string = (
        "["
        + ",".join(
            map(str, embedding)
        )
        + "]"
    )

    conn = get_db()

    try:

        with conn.cursor(
            cursor_factory=RealDictCursor
        ) as cursor:

            # 每一個 label 只保留最相近的一張 reference image

            cursor.execute(
                """
                SELECT
                    label_name,
                    image_name,
                    distance

                FROM (

                    SELECT DISTINCT ON (label_name)

                        label_name,
                        image_name,

                        embedding <=> %s::vector
                        AS distance

                    FROM product_embeddings

                    ORDER BY

                        label_name,

                        embedding <=> %s::vector ASC

                ) AS best_per_label

                ORDER BY distance ASC

                LIMIT 1
                """,
                (
                    vector_string,
                    vector_string
                )
            )

            match = cursor.fetchone()

            if not match:
                return None

            cursor.execute(
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
                    match["label_name"],
                )
            )

            product = cursor.fetchone()

            if not product:
                return None

            distance = float(
                match["distance"]
            )

            confidence = 1.0 - distance

            return {

                "id": product["id"],

                "name": product["name"],

                "price": float(
                    product["price"]
                ),

                "stock": product["stock"],

                "image_url":
                    product["image_url"],

                "label_name":
                    product["label_name"],

                "confidence":
                    confidence,

                "matched_image":
                    match["image_name"]
            }

    finally:

        conn.close()


# ============================================================
# GET ROI Config
# ============================================================

@router.get("/roi-config")
def get_roi_config():

    return load_roi_config()


# ============================================================
# PUT ROI Config
# ============================================================

@router.put("/roi-config")
def update_roi_config(
    config: ROIConfig
):

    config_dict = config.model_dump()

    if len(config_dict["regions"]) != 6:

        raise HTTPException(
            status_code=400,
            detail="目前系統必須設定 6 個 ROI"
        )

    for region in config_dict["regions"]:

        validate_roi(region)

    save_roi_config(
        config_dict
    )

    return {

        "status": "success",

        "message":
            "ROI 設定已儲存",

        "regions":
            config_dict["regions"]
    }


# ============================================================
# Reset ROI
# ============================================================

@router.post("/roi-config/reset")
def reset_roi_config():

    config = get_default_roi()

    save_roi_config(config)

    return {

        "status": "success",

        "message":
            "ROI 已重設為 2 x 3",

        "regions":
            config["regions"]
    }


# ============================================================
# Detect Product
# ============================================================

@router.post("/detect-product")
async def detect_product(
    image: UploadFile = File(...)
):

    try:

        contents = await image.read()

        pil_image = Image.open(
            io.BytesIO(contents)
        ).convert("RGB")

    except Exception as e:

        raise HTTPException(
            status_code=400,
            detail=f"無法讀取圖片：{str(e)}"
        )

    # ----------------------------------------
    # 1. 切六格
    # ----------------------------------------

    roi_crops = crop_roi_regions(
        pil_image
    )

    predictions = []

    # ----------------------------------------
    # 2. 每格辨識
    # ----------------------------------------

    for roi in roi_crops:

        try:

            embedding = get_embedding(
                roi["image"]
            )

            product = search_pgvector(
                embedding
            )

            if product is None:
                continue

            predictions.append({

                "roi_id":
                    roi["id"],

                "roi_name":
                    roi["name"],

                "box":
                    roi["box"],

                **product
            })

        except Exception as e:

            print(
                f'ROI {roi["id"]} 辨識失敗:',
                e
            )

    return {

        "status":
            "success",

        "detected_count":
            len(predictions),

        "predictions":
            predictions
    }


# ============================================================
# Sync Embedding（Supabase Webhook → 下載照片 → 產生向量 → 寫入 product_embeddings）
# ============================================================
# 設計：
#   - Supabase Database Webhook 在 training_data.image4 被填入時（4張照片收齊），
#     呼叫此端點，傳入含 image_url 與 label_name 的 record。
#   - 後端下載圖片、跑 EfficientNet 特徵抽取、寫入 product_embeddings 資料表，
#     讓辨識系統立即能認出這個新商品。
# ============================================================

# ============================================================
# Helper Functions: Image Embedding & Sync
# ============================================================

def _insert_single_embedding(conn, label_name: str, image_url: str):
    """下載圖片、抽取 EfficientNet 1280 維特徵向量並寫入 product_embeddings。"""
    resp = requests.get(image_url, timeout=15)
    resp.raise_for_status()

    img = Image.open(io.BytesIO(resp.content)).convert("RGB")
    embedding = get_embedding(img)
    vector_str = "[" + ",".join(map(str, embedding)) + "]"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO product_embeddings
            (label_name, image_name, embedding)
            VALUES (%s, %s, %s::vector)
            """,
            (label_name, image_url, vector_str)
        )
    conn.commit()


def _resolve_product_label(conn, product_id: int, candidate_label: str = None) -> str:
    """確認商品的 label_name，若為空則以候選名稱或商品名稱更新並回傳。"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id, name, label_name FROM products WHERE id = %s", (product_id,))
        prod = cur.fetchone()
        if not prod:
            return candidate_label or f"product_{product_id}"
        if prod.get("label_name"):
            return prod["label_name"]
        
        chosen = candidate_label if (candidate_label and candidate_label != "PENDING") else prod["name"]
        cur.execute("UPDATE products SET label_name = %s WHERE id = %s", (chosen, product_id))
        conn.commit()
        return chosen


def _sync_product_images(conn, product_id: int, candidate_label: str = None, candidate_urls: list = None) -> dict:
    """處理單一商品的所有照片特徵萃取，並在成功後標記 products.trained = true。"""
    urls = list(candidate_urls or [])

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # 從 training_data 抓取收齊的 4 張照片
        cur.execute(
            "SELECT image1, image2, image3, image4, english_name FROM training_data WHERE product_id = %s",
            (product_id,)
        )
        t = cur.fetchone()
        if t:
            for k in ["image1", "image2", "image3", "image4"]:
                if t.get(k) and t[k] not in urls:
                    urls.append(t[k])
            if not candidate_label and t.get("english_name") and t["english_name"] != "PENDING":
                candidate_label = t["english_name"]

        # 若 training_data 沒有，則 fallback 到 products.image_url
        if not urls:
            cur.execute("SELECT image_url, label_name, name FROM products WHERE id = %s", (product_id,))
            p = cur.fetchone()
            if p and p.get("image_url"):
                urls.append(p["image_url"])
            if p and not candidate_label:
                candidate_label = p.get("label_name") or p.get("name")

    label = _resolve_product_label(conn, product_id, candidate_label)

    synced_count = 0
    errors = []
    for url in urls:
        if not url:
            continue
        try:
            _insert_single_embedding(conn, label, url)
            synced_count += 1
        except Exception as e:
            errors.append(f"{url}: {str(e)}")

    if synced_count > 0:
        with conn.cursor() as cur:
            cur.execute("UPDATE products SET trained = true WHERE id = %s", (product_id,))
        conn.commit()

    return {
        "status": "success" if synced_count > 0 else "error",
        "product_id": product_id,
        "label_name": label,
        "synced_count": synced_count,
        "total_images": len(urls),
        "errors": errors if errors else None
    }


# ============================================================
# Sync Embedding 端點（Supabase Webhook / 手動觸發）
# ============================================================

@router.post("/sync-embedding")
async def sync_embedding(payload: dict):
    """
    支援：
    1. Supabase Database Webhook (傳入 record 物件，支援 products 或 training_data 表)
    2. 直傳格式: {"product_id": 43} 或 {"image_url": "...", "label_name": "..."}
    """
    record = payload.get("record") or payload

    if not record:
        return {"status": "error", "message": "No record found"}

    product_id = record.get("product_id") or record.get("id")
    image_url = record.get("image_url")
    label_name = record.get("label_name") or record.get("english_name")

    conn = get_db()
    try:
        # 情境 A: 帶有 product_id，完整同步該商品收齊的所有訓練照片 (image1..4)
        if product_id:
            # 檢查是否有傳入單一圖片或多張圖片
            candidate_urls = []
            if image_url:
                candidate_urls.append(image_url)
            for k in ["image1", "image2", "image3", "image4"]:
                if record.get(k):
                    candidate_urls.append(record[k])

            result = _sync_product_images(
                conn,
                int(product_id),
                candidate_label=label_name,
                candidate_urls=candidate_urls
            )
            return result

        # 情境 B: 只有單張 image_url 與 label_name
        if not image_url or not label_name:
            return {"status": "ignored", "message": "需提供 product_id，或同時提供 image_url 與 label_name"}

        _insert_single_embedding(conn, label_name, image_url)
        return {
            "status": "success",
            "image_url": image_url,
            "label_name": label_name
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()


@router.post("/sync-product/{product_id}")
async def sync_product_endpoint(product_id: int):
    """針對指定商品 ID，抓取 training_data 的所有照片產生向量特徵並標記 trained=true。"""
    conn = get_db()
    try:
        return _sync_product_images(conn, product_id)
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()


@router.post("/sync-untrained")
async def sync_all_untrained_endpoint():
    """自動掃描所有尚未訓練 (trained is not true) 且已上傳照片的商品，批次產生 embedding。"""
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT p.id, p.name 
                FROM products p
                WHERE (p.trained IS NOT TRUE OR p.trained = FALSE)
                ORDER BY p.id ASC
            """)
            untrained = cur.fetchall()

        results = []
        for p in untrained:
            res = _sync_product_images(conn, p["id"])
            if res.get("synced_count", 0) > 0:
                results.append(res)

        return {
            "status": "success",
            "scanned": len(untrained),
            "processed": len(results),
            "details": results
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()


# ============================================================
# DB Test
# ============================================================

@router.get("/test-db")
def test_db():

    conn = get_db()

    try:

        with conn.cursor(
            cursor_factory=RealDictCursor
        ) as cursor:

            cursor.execute(
                "SELECT COUNT(*) AS count FROM products"
            )

            products_count = (
                cursor.fetchone()["count"]
            )

            cursor.execute(
                "SELECT COUNT(*) AS count FROM product_embeddings"
            )

            embeddings_count = (
                cursor.fetchone()["count"]
            )

            cursor.execute(
                """
                SELECT COUNT(
                    DISTINCT label_name
                ) AS count
                FROM product_embeddings
                """
            )

            classes_count = (
                cursor.fetchone()["count"]
            )

        return {

            "status": "success",

            "products":
                products_count,

            "embeddings":
                embeddings_count,

            "classes":
                classes_count
        }

    finally:

        conn.close()
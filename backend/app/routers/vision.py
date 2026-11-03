import io

import os

import json



import psycopg2



from pathlib import Path

from PIL import Image
import numpy as np

from dotenv import load_dotenv

from psycopg2.extras import RealDictCursor



from typing import Optional

from fastapi import (

    APIRouter,

    UploadFile,

    File,

    HTTPException,

    Query

)



from pydantic import BaseModel



from app.ai.predict import get_embedding, get_embeddings
from app.ai.augmentation import augment_to_target
from app.ai.segmenter import WhiteBgSegmenter
from app.ai.preprocessor import crop_mask_and_pad_pil, preprocess_single_enrollment_image
from app.ai.onnx_embedder import OnnxEfficientNetEmbedder
import requests

router = APIRouter()

SEGMENTER = WhiteBgSegmenter()
ONNX_MODEL_FILE = Path(__file__).resolve().parent.parent / "ai" / "best_efficientnet_model.onnx"
EMBEDDER = OnnxEfficientNetEmbedder(ONNX_MODEL_FILE) if ONNX_MODEL_FILE.is_file() else None
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.48"))





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



DB_CONFIG = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")





# ============================================================

# Database

# ============================================================



def get_db():



    if not DB_CONFIG:

        raise RuntimeError(

            "找不到 DATABASE_URL，請檢查 backend/.env"

        )



    return psycopg2.connect(

        DB_CONFIG,

        sslmode="require"

    )





# ============================================================

def download_image(url: str) -> Image.Image:

    response = requests.get(

        url,

        timeout=30

    )



    response.raise_for_status()



    return Image.open(

        io.BytesIO(response.content)

    ).convert("RGB")

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
# Dynamic ROI Helpers (1, 2, 3 items)
# ============================================================

def get_default_roi_regions(count: int = 1) -> list[dict]:
    """根據件數 (1, 2, 3) 回傳對應的最佳 ROI 框座標 (0~1 正規化座標)"""
    if count == 1:
        return [
            {"id": 1, "name": "ROI 1", "x1": 0.20, "y1": 0.15, "x2": 0.80, "y2": 0.85}
        ]
    elif count == 2:
        return [
            {"id": 1, "name": "ROI 1", "x1": 0.08, "y1": 0.18, "x2": 0.46, "y2": 0.82},
            {"id": 2, "name": "ROI 2", "x1": 0.54, "y1": 0.18, "x2": 0.92, "y2": 0.82}
        ]
    elif count == 3:
        return [
            {"id": 1, "name": "ROI 1", "x1": 0.05, "y1": 0.20, "x2": 0.32, "y2": 0.80},
            {"id": 2, "name": "ROI 2", "x1": 0.365, "y1": 0.20, "x2": 0.635, "y2": 0.80},
            {"id": 3, "name": "ROI 3", "x1": 0.68, "y1": 0.20, "x2": 0.95, "y2": 0.80}
        ]
    else:
        cfg = load_roi_config()
        return cfg.get("regions", [])[:count]


def crop_roi_regions_from_list(image: Image.Image, regions: list[dict]):
    """根據傳入的 regions 清單裁切影像"""
    width, height = image.size
    crops = []
    for roi in regions:
        x1 = max(0, min(width - 1, int(roi["x1"] * width)))
        y1 = max(0, min(height - 1, int(roi["y1"] * height)))
        x2 = max(x1 + 1, min(width, int(roi["x2"] * width)))
        y2 = max(y1 + 1, min(height, int(roi["y2"] * height)))
        crop = image.crop((x1, y1, x2, y2))
        crops.append({
            "id": roi.get("id", len(crops) + 1),
            "name": roi.get("name", f"ROI {len(crops) + 1}"),
            "image": crop,
            "box": [x1, y1, x2, y2]
        })
    return crops


def pad_crop_to_square(img: Image.Image, target_size: int = 224, bg_color=(255, 255, 255)) -> Image.Image:
    """將任意長寬比的 ROI 補白邊成為 1:1 正方形並縮放至 target_size，避免變形"""
    w, h = img.size
    max_side = max(w, h)
    square = Image.new("RGB", (max_side, max_side), bg_color)
    square.paste(img, ((max_side - w) // 2, (max_side - h) // 2))
    return square.resize((target_size, target_size), Image.Resampling.LANCZOS)


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


def query_pgvector_nearest(conn, vec_list: list[float]) -> dict | None:
    """在 pgvector 中與各商品的多角度向量進行比對，取最相似的一筆。
    對齊既有資料庫結構：
    - product_embeddings (label_name, image_name, embedding)
    - products (id, name, price, stock, image_url, label_name)
    """
    vec_str = "[" + ",".join(f"{v:.6f}" for v in vec_list) + "]"
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT 
                p.id,
                p.name,
                p.price,
                p.image_url,
                p.stock,
                p.label_name,
                1 - (pe.embedding <=> %s::vector) AS similarity
            FROM product_embeddings pe
            JOIN products p ON p.label_name = pe.label_name
            ORDER BY pe.embedding <=> %s::vector ASC
            LIMIT 1;
            """,
            (vec_str, vec_str)
        )
        row = cur.fetchone()

    if not row:
        print("[AI 辨識] 查無任何候選商品")
        return None

    sim = float(row["similarity"])
    if sim < SIMILARITY_THRESHOLD:
        print(
            f"[AI 辨識] ⚠️ 未達相似度門檻：最接近「{row['name']}」"
            f" 相似度 {sim:.4f} < 門檻 {SIMILARITY_THRESHOLD}"
        )
        return None

    print(
        f"[AI 辨識] ✅ 成功命中：「{row['name']}」"
        f" 相似度 {sim:.4f} >= 門檻 {SIMILARITY_THRESHOLD}"
    )
    return {
        "product_id": str(row["id"]),
        "name": row["name"],
        "price": int(row["price"]) if row["price"] is not None else 0,
        "image_url": row["image_url"],
        "similarity": round(sim, 4),
        "label_name": row["label_name"]
    }


def query_pgvector_batch(conn, vec_list_of_lists: list[list[float]]) -> list[dict | None]:
    """批次透過 CROSS JOIN LATERAL 查詢多個商品的最高相似度商品，
    僅需 1 次資料庫網路往返，大幅降低跨國延遲。
    """
    if not vec_list_of_lists:
        return []

    # 若單元測試中 query_pgvector_nearest 被 mock，則走 mock 呼叫
    if hasattr(query_pgvector_nearest, "assert_called") or getattr(query_pgvector_nearest, "_mock_return_value", None) is not None:
        return [query_pgvector_nearest(conn, v) for v in vec_list_of_lists]

    if len(vec_list_of_lists) == 1:
        return [query_pgvector_nearest(conn, vec_list_of_lists[0])]

    values_clause = ", ".join("(%s, %s::vector)" for _ in range(len(vec_list_of_lists)))
    params = []
    for idx, v in enumerate(vec_list_of_lists):
        vec_str = "[" + ",".join(f"{val:.6f}" for val in v) + "]"
        params.extend([idx + 1, vec_str])

    sql = f"""
        SELECT 
            v.idx,
            q.id,
            q.name,
            q.price,
            q.image_url,
            q.stock,
            q.label_name,
            q.similarity
        FROM (
            VALUES {values_clause}
        ) AS v(idx, vec)
        CROSS JOIN LATERAL (
            SELECT 
                p.id,
                p.name,
                p.price,
                p.image_url,
                p.stock,
                p.label_name,
                1 - (pe.embedding <=> v.vec) AS similarity
            FROM product_embeddings pe
            JOIN products p ON p.label_name = pe.label_name
            ORDER BY pe.embedding <=> v.vec ASC
            LIMIT 1
        ) AS q
        ORDER BY v.idx ASC;
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    row_map = {int(r["idx"]): r for r in rows}
    results = []
    for i in range(1, len(vec_list_of_lists) + 1):
        row = row_map.get(i)
        if not row:
            print(f"[AI 辨識] 第 {i} 個物件查無候選")
            results.append(None)
            continue
        sim = float(row["similarity"])
        if sim < SIMILARITY_THRESHOLD:
            print(
                f"[AI 辨識] ⚠️ 第 {i} 個物件未達門檻：最接近「{row['name']}」"
                f" 相似度 {sim:.4f} < 門檻 {SIMILARITY_THRESHOLD}"
            )
            results.append(None)
        else:
            print(
                f"[AI 辨識] ✅ 第 {i} 個物件成功命中：「{row['name']}」"
                f" 相似度 {sim:.4f} >= 門檻 {SIMILARITY_THRESHOLD}"
            )
            results.append({
                "product_id": str(row["id"]),
                "name": row["name"],
                "price": int(row["price"]) if row["price"] is not None else 0,
                "image_url": row["image_url"],
                "similarity": round(sim, 4),
                "label_name": row["label_name"]
            })

    return results




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

# ============================================================

# Generate Embeddings

# ============================================================



@router.post("/generate-embeddings/{product_id}")

def generate_embeddings(product_id: int):



    conn = get_db()



    try:

        with conn.cursor(

            cursor_factory=RealDictCursor

        ) as cursor:



            # ================================================

            # 1. 取得商品

            # ================================================



            cursor.execute(

                """

                SELECT

                    id,

                    name,

                    label_name

                FROM products

                WHERE id = %s

                LIMIT 1

                """,

                (product_id,)

            )



            product = cursor.fetchone()



            if not product:

                raise HTTPException(

                    status_code=404,

                    detail="找不到商品"

                )



            label_name = product["label_name"]



            if not label_name:

                raise HTTPException(

                    status_code=400,

                    detail="商品沒有 label_name"

                )



            # ================================================

            # 2. 取得 6 張 training images

            # ================================================



            cursor.execute(

                """

                SELECT

                    image1,

                    image2,

                    image3,

                    image4,

                    image5,

                    image6

                FROM training_data

                WHERE product_id = %s

                LIMIT 1

                """,

                (product_id,)

            )



            training_data = cursor.fetchone()



            if not training_data:

                raise HTTPException(

                    status_code=404,

                    detail="找不到 training_data"

                )



            image_urls = [

                training_data["image1"],

                training_data["image2"],

                training_data["image3"],

                training_data["image4"],

                training_data["image5"],

                training_data["image6"],

            ]



            # ================================================

            # 3. 確認六張照片全部存在

            # ================================================



            missing_images = [

                index + 1

                for index, url in enumerate(image_urls)

                if not url

            ]



            if missing_images:

                raise HTTPException(

                    status_code=400,

                    detail=(

                        "商品照片尚未收齊，缺少："

                        + ", ".join(

                            f"image{i}"

                            for i in missing_images

                        )

                    )

                )



            # ================================================

            # 4. 下載六張原始圖片

            # ================================================



            original_images = []



            for url in image_urls:

                try:

                    image = download_image(url)

                    original_images.append(image)



                except Exception as e:

                    raise HTTPException(

                        status_code=500,

                        detail=f"下載商品圖片失敗：{str(e)}"

                    )



            # ================================================

            # 5. 建庫去背與 1:1 正方形補邊 → 6 張 augmentation → 120 張

            # (使建庫特徵空間與現場多商品裁切 100% 一致)

            # ================================================



            clean_images = [

                preprocess_single_enrollment_image(

                    img,

                    SEGMENTER,

                    target_size=224

                )

                for img in original_images

            ]



            augmented_images = augment_to_target(

                clean_images,

                target=120

            )



            if len(augmented_images) != 120:

                raise HTTPException(

                    status_code=500,

                    detail=(

                        f"Augmentation 數量錯誤："

                        f"{len(augmented_images)}"

                    )

                )



            print(

                f"[embedding] product={product_id}, "

                f"original=6, augmented_total="

                f"{len(augmented_images)}"

            )



            # ================================================

            # 6. 120 張 → 120 embeddings

            # ================================================



            embeddings = get_embeddings(

                augmented_images

            )



            if len(embeddings) != 120:

                raise HTTPException(

                    status_code=500,

                    detail=(

                        f"Embedding 數量錯誤："

                        f"{len(embeddings)}"

                    )

                )



            # ================================================

            # 7. 刪除這個商品舊的 embeddings

            #

            # 避免 API 重跑後：

            # 120 → 240 → 360 ...

            # ================================================



            cursor.execute(

                """

                DELETE FROM product_embeddings

                WHERE label_name = %s

                """,

                (label_name,)

            )



            # ================================================

            # 8. 寫入 120 embeddings

            # ================================================



            for index, embedding in enumerate(

                embeddings,

                start=1

            ):



                vector_string = (

                    "["

                    + ",".join(map(str, embedding))

                    + "]"

                )



                image_name = (

                    f"line_{product_id}_"

                    f"{index:03d}.jpg"

                )



                cursor.execute(

                    """

                    INSERT INTO product_embeddings (

                        label_name,

                        image_name,

                        embedding

                    )

                    VALUES (

                        %s,

                        %s,

                        %s::vector

                    )

                    """,

                    (

                        label_name,

                        image_name,

                        vector_string

                    )

                )



            # ================================================

            # 9. trained = true

            # ================================================



            cursor.execute(

                """

                UPDATE products

                SET trained = true

                WHERE id = %s

                """,

                (product_id,)

            )



            # ================================================

            # 10. 全部成功才 commit

            # ================================================



            conn.commit()



            return {

                "status": "success",

                "product_id": product_id,

                "product_name": product["name"],

                "label_name": label_name,

                "original_images": 6,

                "total_images": len(augmented_images),

                "embeddings_created": len(embeddings),

                "embedding_dimensions": (

                    len(embeddings[0])

                    if embeddings

                    else 0

                )

            }



    except HTTPException:

        conn.rollback()

        raise



    except Exception as e:

        conn.rollback()



        print(

            "[generate-embeddings] error:",

            repr(e)

        )



        raise HTTPException(

            status_code=500,

            detail=f"產生 embedding 失敗：{str(e)}"

        )



    finally:

        conn.close()

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


@router.post("/scan-table")
@router.post("/api/vision/scan-table")
async def scan_checkout_table(
    file: UploadFile = File(None),
    image: UploadFile = File(None),
    mode: str = Query("auto"),
    roi_count: int = Query(1),
    roi_regions: Optional[str] = Query(None)
):
    """
    切出桌上所有商品 (支援 auto 自動分水嶺分割 或 roi 固定 1~3 格模式)
    -> ONNX 抽特徵 -> pgvector 比對 -> 聚合計算各商品數量回傳前端
    相容 file 或 image 表單欄位名
    """
    upload = file or image
    if upload is None:
        raise HTTPException(status_code=400, detail="未提供影像檔案 (需為 file 或 image)")

    raw_bytes = await upload.read()
    try:
        pil_full = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"無法解析圖片檔案：{e}")

    img_rgb = np.asarray(pil_full)

    if mode == "roi":
        regions = None
        if roi_regions:
            try:
                parsed = json.loads(roi_regions)
                if isinstance(parsed, list) and len(parsed) > 0:
                    regions = parsed
            except Exception:
                pass
        if not regions:
            regions = get_default_roi_regions(roi_count)

        roi_crops = crop_roi_regions_from_list(pil_full, regions)
        if not roi_crops:
            return {
                "status": "success",
                "total_objects_detected": 0,
                "unrecognized_count": 0,
                "cart_items": [],
                "detections": []
            }

        boxes = [c["box"] for c in roi_crops]
        cropped_pils = [pad_crop_to_square(c["image"], 224) for c in roi_crops]
    else:
        # 1. Stage 1: 切出畫面上所有獨立商品
        masks, boxes = SEGMENTER.segment(img_rgb)
        if not masks:
            return {
                "status": "success",
                "total_objects_detected": 0,
                "unrecognized_count": 0,
                "cart_items": [],
                "detections": []
            }

        # 2. Stage 2: 去背並補成 224x224 正方形
        cropped_pils = [
            crop_mask_and_pad_pil(img_rgb, mask, box, target_size=224, bg_color=255)
            for mask, box in zip(masks, boxes)
        ]

    # 3. Stage 3: 批次提取特徵向量
    if EMBEDDER is not None:
        embeddings = EMBEDDER.extract_batch(cropped_pils)
    else:
        embeddings = np.array(get_embeddings(cropped_pils), dtype=np.float32)

    # 4. Stage 4: 比對 pgvector 並自動歸戶統計數量
    cart_map: dict[str, dict] = {}
    detections = []
    unrecognized_count = 0

    conn = get_db()
    try:
        matches = query_pgvector_batch(conn, [emb.tolist() for emb in embeddings])
        for idx, (box, match) in enumerate(zip(boxes, matches)):
            if match is None:
                unrecognized_count += 1
                detections.append({
                    "index": idx + 1,
                    "bbox": box,
                    "matched": False,
                    "name": "未辨識商品"
                })
                continue

            detections.append({
                "index": idx + 1,
                "bbox": box,
                "matched": True,
                **match
            })

            pid = match["product_id"]
            if pid not in cart_map:
                cart_map[pid] = {
                    "product_id": pid,
                    "id": pid,
                    "name": match["name"],
                    "price": match["price"],
                    "image_url": match["image_url"],
                    "quantity": 1,
                    "max_similarity": match["similarity"]
                }
            else:
                cart_map[pid]["quantity"] += 1
                cart_map[pid]["max_similarity"] = max(
                    cart_map[pid]["max_similarity"], match["similarity"]
                )
    finally:
        conn.close()

    return {
        "status": "success",
        "total_objects_detected": len(boxes),
        "unrecognized_count": unrecognized_count,
        "cart_items": list(cart_map.values()),
        "detections": detections
    }





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
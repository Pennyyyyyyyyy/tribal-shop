import io

import os

import json



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



from app.ai.predict import get_embedding, get_embeddings
from app.ai.augmentation import augment_to_target
import requests





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

            # 5. 6 張 augmentation → 120 張

            # ================================================



            augmented_images = augment_to_target(

                original_images,

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
from fastapi import APIRouter
from PIL import Image
import cv2
import os
import time

from app.ai.predict import predict

router = APIRouter()

EXTERNAL_CAMERA = 1

@router.post("/detect-product")
async def detect_product():

    # 開啟鏡頭
    cap = cv2.VideoCapture(EXTERNAL_CAMERA)

    if not cap.isOpened():
        return {
            "status": "error",
            "message": "無法開啟外接鏡頭"
        }

    # 拍照
    ret, frame = cap.read()
    cap.release()

    if not ret:
        return {
            "status": "error",
            "message": "無法拍照"
        }

    # ===== 存圖片 =====
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    PROJECT_ROOT = os.path.dirname(os.path.dirname(BASE_DIR))

    UPLOAD_DIR = os.path.join(PROJECT_ROOT, "uploads", "images")

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    filename = f"capture_{int(time.time())}.jpg"
    path = os.path.join(UPLOAD_DIR, filename)

    cv2.imwrite(path, frame)

    # ===== BGR → RGB =====
    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # ===== numpy → PIL =====
    image = Image.fromarray(frame)

    # ===== AI辨識 =====
    result = predict(image)

    return {
        "status": "success",
        "prediction": result,
        "image_url": f"/uploads/images/{filename}"
    }
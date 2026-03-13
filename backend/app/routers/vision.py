from fastapi import APIRouter, UploadFile, File
from PIL import Image
import io

from app.ai.predict import predict_image

router = APIRouter()


@router.post("/detect")
async def detect_product(file: UploadFile = File(...)):

    contents = await file.read()

    image = Image.open(io.BytesIO(contents)).convert("RGB")

    result = predict_image(image)

    return {
        "status": "success",
        "prediction": result
    }

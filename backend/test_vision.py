import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.routers.vision import router as vision_router

app = FastAPI()

# backend 資料夾
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# uploads 的完整路徑
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_DIR),
    name="uploads"
)

app.include_router(vision_router, prefix="/vision", tags=["vision"])
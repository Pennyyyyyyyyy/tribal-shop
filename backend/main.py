from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import products, checkout, admin, line_webhook
from backend import test_vision

# 1. 初始化資料庫
init_db()

app = FastAPI()

# 2. 設定 CORS (讓前端 React 可以連線)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. 掛載圖片資料夾 (讓前端與 LINE 可以讀取上傳的照片)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# 4. 註冊路由 (功能模組)
app.include_router(products.router)
app.include_router(checkout.router)
app.include_router(admin.router)
app.include_router(vision.router, prefix="/vision", tags=["vision"])
app.include_router(line_webhook.router)

if __name__ == "__main__":
    import uvicorn
    # 啟動伺服器
    uvicorn.run(app, host="127.0.0.1", port=8000)
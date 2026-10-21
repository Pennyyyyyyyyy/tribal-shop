from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import products, checkout, admin, line_webhook, vision

import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path


# Embedding Worker 自動啟動與關閉
@asynccontextmanager
async def lifespan(app: FastAPI):
    backend_dir = Path(__file__).resolve().parent
    worker_script = backend_dir / "embedding_worker.py"

    if not worker_script.is_file():
        raise RuntimeError(f"找不到 Embedding Worker：{worker_script}")

    worker_process = subprocess.Popen(
        [sys.executable, str(worker_script)],
        cwd=str(backend_dir),
    )

    print(f"[FastAPI] Embedding Worker 已啟動 (PID={worker_process.pid})")

    try:
        yield
    finally:
        if worker_process.poll() is None:
            worker_process.terminate()
            try:
                worker_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                worker_process.kill()
                worker_process.wait()

        print("[FastAPI] Embedding Worker 已停止")


# 1. 初始化資料庫
init_db()

app = FastAPI(lifespan=lifespan)

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
app.include_router(vision.router, prefix="/vision", tags=["Vision"])
app.include_router(line_webhook.router)

if __name__ == "__main__":
    import uvicorn
    # 啟動伺服器
    uvicorn.run(app, host="127.0.0.1", port=8000)
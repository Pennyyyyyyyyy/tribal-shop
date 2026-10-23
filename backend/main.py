import os
# 設定 ARM CPU 基礎指令集，避免樹莓派上 OpenBLAS/PyTorch 誤判觸發 SIGILL (無效指令)
os.environ.setdefault("OPENBLAS_CORETYPE", "ARMV8")
os.environ.setdefault("OMP_NUM_THREADS", "2")

import asyncio
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import vision, payment
from app.hardware.coin_listener import start_coin_listener, stop_coin_listener


# Lifespan: 管理 Embedding Worker 與 投幣機 GPIO 監聽
@asynccontextmanager
async def lifespan(app: FastAPI):
    backend_dir = Path(__file__).resolve().parent
    worker_script = backend_dir / "embedding_worker.py"

    if not worker_script.is_file():
        raise RuntimeError(f"找不到 Embedding Worker：{worker_script}")

    # 1. 啟動 Embedding Worker
    worker_process = subprocess.Popen(
        [sys.executable, str(worker_script)],
        cwd=str(backend_dir),
    )
    print(f"[FastAPI] Embedding Worker 已啟動 (PID={worker_process.pid})")

    # 2. 啟動樹莓派投幣機 GPIO 監聽 (BCM 27 / Pin 13)
    loop = asyncio.get_running_loop()
    start_coin_listener(loop, payment.manager.broadcast)

    try:
        yield
    finally:
        # 關閉投幣機 GPIO
        stop_coin_listener()

        # 關閉 Embedding Worker
        if worker_process.poll() is None:
            worker_process.terminate()
            try:
                worker_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                worker_process.kill()
                worker_process.wait()

        print("[FastAPI] Embedding Worker 與投幣機服務已停止")


app = FastAPI(title="Flying Squirrel Shop Vision & Coin API", lifespan=lifespan)

# 設定 CORS (讓前端 React 可以連線)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊路由
app.include_router(vision.router, prefix="/vision", tags=["Vision"])
app.include_router(payment.router, tags=["Payment"])


@app.get("/")
def root():
    return {"status": "ok", "service": "vision-and-coin-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import vision


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


app = FastAPI(title="Flying Squirrel Shop Vision API", lifespan=lifespan)

# 設定 CORS (讓前端 React 可以連線)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊路由 (專責樹莓派本地 Vision 影像辨識與特徵抽取)
app.include_router(vision.router, prefix="/vision", tags=["Vision"])


@app.get("/")
def root():
    return {"status": "ok", "service": "vision-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

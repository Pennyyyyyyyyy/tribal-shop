"""Poll Supabase embedding_jobs and invoke the existing FastAPI embedding endpoint.

Run from the backend project root while FastAPI is running:
    python embedding_worker.py

No existing backend or Cloudflare source files need to be modified.
"""

import logging
import os
import time
from pathlib import Path

import psycopg2
import requests
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DB_URL = os.getenv("SUPABASE_DB_URL")
API_URL = os.getenv(
    "EMBEDDING_API_URL", "http://127.0.0.1:8000/vision/generate-embeddings"
).rstrip("/")
POLL_SECONDS = max(1, int(os.getenv("EMBEDDING_POLL_SECONDS", "5")))
# Augmenting and embedding 120 images on a CPU can take some time.
REQUEST_TIMEOUT = max(30, int(os.getenv("EMBEDDING_REQUEST_TIMEOUT", "900")))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("embedding_worker")


def connect():
    if not DB_URL:
        raise RuntimeError("backend/.env 缺少 SUPABASE_DB_URL")
    return psycopg2.connect(DB_URL, sslmode="require")


def claim_job():
    """Atomically claim one pending job; multiple workers cannot claim the same row."""
    with connect() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                WITH next_job AS (
                    SELECT id
                    FROM embedding_jobs
                    WHERE status = 'pending'
                      AND attempts < max_attempts
                    ORDER BY created_at, id
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                )
                UPDATE embedding_jobs AS j
                SET status = 'processing',
                    attempts = j.attempts + 1,
                    locked_at = NOW(),
                    last_error = NULL,
                    updated_at = NOW()
                FROM next_job
                WHERE j.id = next_job.id
                RETURNING j.id, j.product_id, j.attempts, j.max_attempts
                """
            )
            return cursor.fetchone()


def finish_job(job_id, status, error=None):
    with connect() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE embedding_jobs
                SET status = %s,
                    last_error = %s,
                    locked_at = NULL,
                    completed_at = CASE WHEN %s = 'completed' THEN NOW() ELSE NULL END,
                    updated_at = NOW()
                WHERE id = %s AND status = 'processing'
                """,
                (status, error, status, job_id),
            )
            if cursor.rowcount != 1:
                raise RuntimeError(
                    f"無法更新任務 {job_id}：任務已不在 processing 狀態"
                )


def process_job(job):
    job_id = job["id"]
    product_id = job["product_id"]
    logger.info(
        "開始處理 job=%s product=%s attempt=%s/%s",
        job_id, product_id, job["attempts"], job["max_attempts"],
    )
    try:
        response = requests.post(
            f"{API_URL}/{product_id}", timeout=REQUEST_TIMEOUT
        )
        response.raise_for_status()
        result = response.json()
        if result.get("status") != "success":
            raise RuntimeError(f"FastAPI 回傳非成功結果：{result}")
        if result.get("embeddings_created") != 120:
            raise RuntimeError(f"Embedding 數量不是 120：{result}")
    except Exception as exc:
        error = str(exc)[:4000]
        logger.exception("任務失敗 job=%s product=%s", job_id, product_id)
        finish_job(job_id, "failed", error)
        return

    finish_job(job_id, "completed")
    logger.info("任務完成 job=%s product=%s，建立 %s 筆向量", job_id, product_id, result["embeddings_created"])


def main():
    logger.info("Embedding Worker 啟動；API=%s；輪詢間隔=%s 秒", API_URL, POLL_SECONDS)
    logger.info("僅自動處理 pending；failed 與意外中斷的 processing 不會自動重試")
    while True:
        try:
            job = claim_job()
            if job:
                process_job(job)
            else:
                time.sleep(POLL_SECONDS)
        except KeyboardInterrupt:
            logger.info("使用者停止 Worker")
            break
        except Exception:
            logger.exception("背景程式發生錯誤，%s 秒後重試", POLL_SECONDS)
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
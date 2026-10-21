"""
LINE Webhook 端點 — 接收 Rich Menu postback 及使用者訊息。
"""

import json

from fastapi import APIRouter, Request, HTTPException

from app.services.line_bot_service import verify_signature, handle_event

router = APIRouter(tags=["LINE Webhook"])


@router.post("/callback")
async def line_callback(request: Request):
    signature = request.headers.get("X-Line-Signature", "")
    body = await request.body()

    if not verify_signature(body, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    data = json.loads(body)
    for event in data.get("events", []):
        try:
            handle_event(event)
        except Exception as e:
            print(f"[LINE Bot] 處理事件失敗: {e}")

    return "OK"

import os
import base64
import requests as http_requests
from dotenv import load_dotenv
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    BroadcastRequest,
    TextMessage,
    ImageMessage,
)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

_config = None
_LINE_CHANNEL_ACCESS_TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")
_SERVER_BASE_URL = os.getenv("SERVER_BASE_URL", "").rstrip("/")

FREEIMAGE_API_KEY = "6d207e02198a847aa98d0a2a901485a5"


def _build_public_url(image_path: str) -> str | None:
    """有設 SERVER_BASE_URL 就直接組公開網址（走 backend 的 /uploads 靜態檔），不再依賴外部圖床。"""
    if not _SERVER_BASE_URL or not image_path:
        return None
    rel = image_path.replace("\\", "/").lstrip("./").lstrip("/")
    return f"{_SERVER_BASE_URL}/{rel}"


def _get_api() -> MessagingApi | None:
    global _config
    if not _LINE_CHANNEL_ACCESS_TOKEN:
        return None
    if _config is None:
        _config = Configuration(access_token=_LINE_CHANNEL_ACCESS_TOKEN)
    return MessagingApi(ApiClient(_config))


def _upload_image(image_path: str) -> str | None:
    """將本地圖片上傳到 freeimage.host，回傳公開 HTTPS URL。"""
    if not image_path or not os.path.isfile(image_path):
        return None
    try:
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        resp = http_requests.post(
            "https://freeimage.host/api/1/upload",
            data={"key": FREEIMAGE_API_KEY, "source": b64, "format": "json"},
            timeout=30,
        )
        if resp.ok:
            url = resp.json().get("image", {}).get("url")
            print(f"[LINE] 圖片已上傳: {url}")
            return url
        print(f"[LINE] 圖片上傳失敗: {resp.status_code}")
    except Exception as e:
        print(f"[LINE] 圖片上傳例外: {e}")
    return None


def send_line_notification(message: str, image_path: str | None = None):
    """
    發送 LINE 通知（文字 + 可選圖片）給所有 Bot 好友。
    圖片會自動上傳到圖床取得公開 URL，不需要 SERVER_BASE_URL。
    """
    api = _get_api()

    if api is None:
        print(f"\n======== [LINE Notify - 模擬] ========")
        print(f"訊息: {message}")
        if image_path:
            print(f"附圖: {image_path}")
        print(f"======================================\n")
        return

    messages = [TextMessage(text=message)]

    if image_path:
        # 優先用 SERVER_BASE_URL（穩定、零延遲），沒設才 fallback 走 freeimage 圖床
        image_url = _build_public_url(image_path) or _upload_image(image_path)
        if image_url:
            messages.append(
                ImageMessage(
                    originalContentUrl=image_url,
                    previewImageUrl=image_url,
                )
            )

    try:
        api.broadcast(BroadcastRequest(messages=messages))
        print(f"[LINE] 已發送廣播通知（含 {len(messages)} 則訊息）")
    except Exception as e:
        print(f"[LINE] 發送失敗: {e}")

"""
建立 LINE Rich Menu（部落商店管理選單）

執行方式：
    cd backend
    python -m scripts.setup_rich_menu

需要：
    1. .env 裡的 LINE_CHANNEL_ACCESS_TOKEN
    2. pip install Pillow（產生選單圖片）
"""

import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")
API = "https://api.line.me/v2/bot"
DATA_API = "https://api-data.line.me/v2/bot"


# ── 1. 產生 2500×1686 的選單圖片 ─────────────────────────
def create_image() -> str:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("正在安裝 Pillow …")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
        from PIL import Image, ImageDraw, ImageFont

    W, H = 2500, 1686
    hw, hh = W // 2, H // 2

    colors = ["#2D6A4F", "#40916C", "#52B788", "#74C69D"]
    regions = [
        (0, 0, hw, hh),
        (hw, 0, W, hh),
        (0, hh, hw, H),
        (hw, hh, W, H),
    ]

    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)

    for rect, color in zip(regions, colors):
        draw.rectangle(rect, fill=color)

    # 分隔線
    draw.line([(hw, 0), (hw, H)], fill="white", width=4)
    draw.line([(0, hh), (W, hh)], fill="white", width=4)

    # 字型（macOS 優先，fallback 到預設）
    font = None
    for fp in [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    ]:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, 72)
                break
            except Exception:
                continue
    if font is None:
        font = ImageFont.load_default()

    labels = ["建立新商品", "庫存更新", "除帳", "布告欄"]
    centers = [
        (hw // 2, hh // 2),
        (hw + hw // 2, hh // 2),
        (hw // 2, hh + hh // 2),
        (hw + hw // 2, hh + hh // 2),
    ]

    for label, (cx, cy) in zip(labels, centers):
        bbox = draw.textbbox((0, 0), label, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text((cx - tw // 2, cy - th // 2), label, fill="white", font=font)

    out = str(Path(__file__).resolve().parent.parent / "rich_menu.png")
    img.save(out)
    print(f"圖片已產生: {out}")
    return out


# ── 2. 刪除舊 Rich Menu ──────────────────────────────────
def delete_old():
    headers = {"Authorization": f"Bearer {TOKEN}"}
    resp = requests.get(f"{API}/richmenu/list", headers=headers)
    if resp.ok:
        for m in resp.json().get("richmenus", []):
            rid = m["richMenuId"]
            requests.delete(f"{API}/richmenu/{rid}", headers=headers)
            print(f"已刪除: {rid}")


# ── 3. 建立 Rich Menu ────────────────────────────────────
def create_menu() -> str:
    body = {
        "size": {"width": 2500, "height": 1686},
        "selected": True,
        "name": "部落商店管理選單",
        "chatBarText": "管理選單",
        "areas": [
            {
                "bounds": {"x": 0, "y": 0, "width": 1250, "height": 843},
                "action": {
                    "type": "postback",
                    "label": "建立新商品",
                    "data": "action=new_product_menu",
                    "displayText": "建立新商品",
                },
            },
            {
                "bounds": {"x": 1250, "y": 0, "width": 1250, "height": 843},
                "action": {
                    "type": "postback",
                    "label": "庫存更新",
                    "data": "action=inventory",
                    "displayText": "庫存更新",
                },
            },
            {
                "bounds": {"x": 0, "y": 843, "width": 1250, "height": 843},
                "action": {
                    "type": "postback",
                    "label": "除帳",
                    "data": "action=debt_menu",
                    "displayText": "除帳",
                },
            },
            {
                "bounds": {"x": 1250, "y": 843, "width": 1250, "height": 843},
                "action": {
                    "type": "postback",
                    "label": "布告欄",
                    "data": "action=bulletin",
                    "displayText": "布告欄",
                },
            },
        ],
    }

    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    }
    resp = requests.post(f"{API}/richmenu", headers=headers, json=body)
    if not resp.ok:
        print(f"建立失敗: {resp.status_code} {resp.text}")
        sys.exit(1)

    rid = resp.json()["richMenuId"]
    print(f"Rich Menu 已建立: {rid}")
    return rid


# ── 4. 上傳圖片 ──────────────────────────────────────────
def upload_image(rich_menu_id: str, image_path: str):
    with open(image_path, "rb") as f:
        resp = requests.post(
            f"{DATA_API}/richmenu/{rich_menu_id}/content",
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "image/png",
            },
            data=f.read(),
        )
    if not resp.ok:
        print(f"圖片上傳失敗: {resp.status_code} {resp.text}")
        sys.exit(1)
    print("圖片已上傳")


# ── 5. 設為預設選單 ──────────────────────────────────────
def set_default(rich_menu_id: str):
    resp = requests.post(
        f"{API}/user/all/richmenu/{rich_menu_id}",
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    if not resp.ok:
        print(f"設定預設失敗: {resp.status_code} {resp.text}")
        sys.exit(1)
    print("已設為預設 Rich Menu")


# ── main ──────────────────────────────────────────────────
def main():
    if not TOKEN:
        print("錯誤：.env 中沒有 LINE_CHANNEL_ACCESS_TOKEN")
        sys.exit(1)

    print("=== 部落商店 Rich Menu 設定 ===\n")

    print("1. 刪除舊的 Rich Menu …")
    delete_old()

    print("\n2. 產生選單圖片 …")
    img = create_image()

    print("\n3. 建立 Rich Menu …")
    rid = create_menu()

    print("\n4. 上傳選單圖片 …")
    upload_image(rid, img)

    print("\n5. 設為預設選單 …")
    set_default(rid)

    print("\n✅ Rich Menu 設定完成！")


if __name__ == "__main__":
    main()

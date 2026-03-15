"""
LINE Bot 互動服務 — 處理 Rich Menu postback、對話流程、圖片上傳等。
"""

import os
import hmac
import hashlib
import base64
import json
from pathlib import Path

import requests as http_requests
from dotenv import load_dotenv

from app.database import get_db

# ── 環境變數 ──────────────────────────────────────────────
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

LINE_CHANNEL_ACCESS_TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")
LINE_CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET", "")

LINE_API = "https://api.line.me/v2/bot"
LINE_DATA_API = "https://api-data.line.me/v2/bot"

# 商品辨識圖片存放目錄
PRODUCT_IMAGES_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "product_images"
PRODUCT_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# ── 對話狀態 (in-memory) ──────────────────────────────────
_user_states: dict = {}


# ── Webhook 驗證 ──────────────────────────────────────────
def verify_signature(body: bytes, signature: str) -> bool:
    digest = hmac.new(
        LINE_CHANNEL_SECRET.encode(), body, hashlib.sha256
    ).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode(), signature)


# ── LINE API 工具 ─────────────────────────────────────────
def _auth_headers(content_type: str = "application/json") -> dict:
    return {
        "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}",
        "Content-Type": content_type,
    }


def reply_message(reply_token: str, messages: list):
    http_requests.post(
        f"{LINE_API}/message/reply",
        headers=_auth_headers(),
        json={"replyToken": reply_token, "messages": messages},
    )


def push_message(user_id: str, messages: list):
    http_requests.post(
        f"{LINE_API}/message/push",
        headers=_auth_headers(),
        json={"to": user_id, "messages": messages},
    )


def download_content(message_id: str) -> bytes:
    resp = http_requests.get(
        f"{LINE_DATA_API}/message/{message_id}/content",
        headers={"Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}"},
    )
    return resp.content


# ── 狀態管理 ──────────────────────────────────────────────
def _get(user_id: str) -> dict:
    return _user_states.get(user_id, {"step": "idle", "data": {}})


def _set(user_id: str, step: str, **extra):
    st = _user_states.setdefault(user_id, {"step": "idle", "data": {}})
    st["step"] = step
    st["data"].update(extra)


def _clear(user_id: str):
    _user_states.pop(user_id, None)


# ── 訊息建構工具 ──────────────────────────────────────────
def _text(t: str) -> dict:
    return {"type": "text", "text": t}


def _qr_postback(label: str, data: str) -> dict:
    return {
        "type": "action",
        "action": {
            "type": "postback",
            "label": label,
            "data": data,
            "displayText": label,
        },
    }


def _text_with_quick_reply(text: str, items: list[dict]) -> dict:
    return {
        "type": "text",
        "text": text,
        "quickReply": {"items": items},
    }


# ══════════════════════════════════════════════════════════
#  事件路由
# ══════════════════════════════════════════════════════════
def handle_event(event: dict):
    etype = event.get("type")
    if etype == "postback":
        _on_postback(event)
    elif etype == "message":
        mtype = event.get("message", {}).get("type")
        if mtype == "text":
            _on_text(event)
        elif mtype == "image":
            _on_image(event)


# ── Postback (Rich Menu / Quick Reply) ───────────────────
def _on_postback(event: dict):
    uid = event["source"]["userId"]
    token = event["replyToken"]
    raw = event["postback"]["data"]
    params = dict(p.split("=", 1) for p in raw.split("&") if "=" in p)
    action = params.get("action", "")

    # 任何 postback 都重設目前流程
    _clear(uid)

    if action == "new_product_menu":
        reply_message(token, [
            _text_with_quick_reply("【建立新商品】請選擇操作：", [
                _qr_postback("新增商品", "action=add_product"),
                _qr_postback("修改商品", "action=edit_product"),
            ]),
        ])

    elif action == "add_product":
        _set(uid, "add_product_name")
        reply_message(token, [_text("請輸入商品名稱：")])

    elif action == "edit_product":
        _set(uid, "edit_product_select")
        reply_message(token, [_text("請輸入要修改的商品名稱：")])

    elif action == "edit_name":
        _set(uid, "edit_product_new_name", product_name=params.get("product", ""))
        reply_message(token, [_text("請輸入新的品名：")])

    elif action == "edit_price":
        _set(uid, "edit_product_new_price", product_name=params.get("product", ""))
        reply_message(token, [_text("請輸入新的價格（數字）：")])

    elif action == "inventory":
        _show_inventory(token)

    elif action == "debt_menu":
        reply_message(token, [
            _text_with_quick_reply("【除帳管理】請選擇操作：", [
                _qr_postback("查看賒帳", "action=view_debts"),
                _qr_postback("記錄還款", "action=record_repay"),
            ]),
        ])

    elif action == "view_debts":
        _show_debts(token)

    elif action == "record_repay":
        _set(uid, "repay_name")
        reply_message(token, [_text("請輸入族人姓名：")])

    elif action == "bulletin":
        reply_message(token, [_text("🚧 此功能開發中，敬請期待！")])


# ── 文字訊息 ─────────────────────────────────────────────
def _on_text(event: dict):
    uid = event["source"]["userId"]
    token = event["replyToken"]
    text = event["message"]["text"].strip()
    state = _get(uid)
    step = state["step"]
    data = state["data"]

    # 沒有進行中的流程
    if step == "idle":
        reply_message(token, [_text("請使用下方選單操作 👇")])
        return

    # ── 新增商品：輸入名稱 ──
    if step == "add_product_name":
        conn = get_db()
        exists = conn.execute("SELECT 1 FROM products WHERE name = ?", (text,)).fetchone()
        conn.close()
        if exists:
            reply_message(token, [_text(f"商品「{text}」已存在，請輸入其他名稱：")])
            return
        _set(uid, "add_product_price", product_name=text)
        reply_message(token, [_text(f"商品名稱：{text}\n請輸入價格（數字）：")])

    # ── 新增商品：輸入價格 ──
    elif step == "add_product_price":
        if not text.isdigit():
            reply_message(token, [_text("請輸入有效的數字：")])
            return
        _set(uid, "add_product_stock", price=int(text))
        reply_message(token, [_text("請輸入庫存數量（數字）：")])

    # ── 新增商品：輸入庫存 ──
    elif step == "add_product_stock":
        if not text.isdigit():
            reply_message(token, [_text("請輸入有效的數字：")])
            return
        name = data["product_name"]
        price = data["price"]
        stock = int(text)

        conn = get_db()
        try:
            conn.execute(
                "INSERT INTO products (name, price, stock) VALUES (?, ?, ?)",
                (name, price, stock),
            )
            conn.commit()
        except Exception:
            conn.close()
            reply_message(token, [_text("建立失敗，商品名稱可能重複")])
            _clear(uid)
            return
        conn.close()

        _set(uid, "add_product_images", images_received=0)
        reply_message(token, [
            _text(
                f"商品「{name}」已建立（${price}，庫存 {stock}）\n\n"
                f"請上傳 4 張商品圖片（供辨識系統使用）\n"
                f"可一次或分次傳送"
            ),
        ])

    # ── 修改商品：選擇商品 ──
    elif step == "edit_product_select":
        conn = get_db()
        product = conn.execute(
            "SELECT name, price, stock FROM products WHERE name = ?", (text,)
        ).fetchone()
        conn.close()
        if not product:
            reply_message(token, [_text(f"找不到商品「{text}」，請重新輸入：")])
            return
        pname = product["name"]
        _set(uid, "edit_product_field", product_name=pname)
        reply_message(token, [
            _text_with_quick_reply(
                f"商品「{pname}」\n價格: ${product['price']}\n庫存: {product['stock']}\n\n請選擇要修改的項目：",
                [
                    _qr_postback("品名", f"action=edit_name&product={pname}"),
                    _qr_postback("價格", f"action=edit_price&product={pname}"),
                ],
            ),
        ])

    # ── 修改商品：新品名 ──
    elif step == "edit_product_new_name":
        old = data["product_name"]
        conn = get_db()
        try:
            conn.execute("UPDATE products SET name = ? WHERE name = ?", (text, old))
            conn.execute(
                "UPDATE product_images SET product_name = ? WHERE product_name = ?",
                (text, old),
            )
            conn.commit()
            reply_message(token, [_text(f"✅ 已將「{old}」更名為「{text}」")])
        except Exception:
            reply_message(token, [_text("更新失敗，新品名可能已存在")])
        finally:
            conn.close()
        _clear(uid)

    # ── 修改商品：新價格 ──
    elif step == "edit_product_new_price":
        if not text.isdigit():
            reply_message(token, [_text("請輸入有效的數字：")])
            return
        pname = data["product_name"]
        conn = get_db()
        conn.execute("UPDATE products SET price = ? WHERE name = ?", (int(text), pname))
        conn.commit()
        conn.close()
        reply_message(token, [_text(f"✅ 已將「{pname}」的價格更新為 ${text}")])
        _clear(uid)

    # ── 還款：輸入姓名 ──
    elif step == "repay_name":
        conn = get_db()
        member = conn.execute(
            "SELECT name, total_debt FROM members WHERE name = ?", (text,)
        ).fetchone()
        conn.close()
        if not member:
            reply_message(token, [_text(f"找不到族人「{text}」，請重新輸入：")])
            return
        _set(uid, "repay_amount", member_name=text)
        reply_message(token, [
            _text(f"族人「{text}」目前欠款: ${member['total_debt']}\n\n請輸入還款金額（數字）："),
        ])

    # ── 還款：輸入金額 ──
    elif step == "repay_amount":
        if not text.isdigit():
            reply_message(token, [_text("請輸入有效的數字：")])
            return
        amount = int(text)
        name = data["member_name"]
        conn = get_db()
        member = conn.execute(
            "SELECT total_debt FROM members WHERE name = ?", (name,)
        ).fetchone()
        new_debt = max(0, member["total_debt"] - amount)
        conn.execute("UPDATE members SET total_debt = ? WHERE name = ?", (new_debt, name))
        conn.commit()
        conn.close()
        reply_message(token, [
            _text(f"✅ 已記錄 {name} 還款 ${amount}\n剩餘欠款: ${new_debt}"),
        ])
        _clear(uid)


# ── 圖片訊息 ─────────────────────────────────────────────
def _on_image(event: dict):
    uid = event["source"]["userId"]
    token = event["replyToken"]
    msg_id = event["message"]["id"]
    state = _get(uid)

    if state["step"] != "add_product_images":
        reply_message(token, [_text("請使用下方選單操作 👇")])
        return

    data = state["data"]
    product_name = data["product_name"]
    received = data.get("images_received", 0)

    # 下載並儲存圖片
    content = download_content(msg_id)
    product_dir = PRODUCT_IMAGES_DIR / product_name
    product_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{received + 1}.jpg"
    (product_dir / filename).write_bytes(content)

    # 寫入 DB
    conn = get_db()
    conn.execute(
        "INSERT INTO product_images (product_name, image_path) VALUES (?, ?)",
        (product_name, str(product_dir / filename)),
    )
    conn.commit()
    conn.close()

    received += 1

    if received >= 4:
        reply_message(token, [
            _text(f"✅ 商品「{product_name}」已上傳 4 張辨識圖片！\n商品建立完成 🎉"),
        ])
        _clear(uid)
    else:
        _set(uid, "add_product_images", images_received=received)
        reply_message(token, [
            _text(f"已收到第 {received} 張圖片（還需要 {4 - received} 張）"),
        ])


# ══════════════════════════════════════════════════════════
#  功能：庫存一覽 (Flex Message)
# ══════════════════════════════════════════════════════════
def _show_inventory(token: str):
    conn = get_db()
    products = conn.execute(
        "SELECT name, price, stock FROM products ORDER BY name"
    ).fetchall()
    conn.close()

    if not products:
        reply_message(token, [_text("目前沒有商品資料")])
        return

    rows: list[dict] = []
    for i, p in enumerate(products):
        stock_color = "#FF0000" if p["stock"] < 5 else "#111111"
        rows.append({
            "type": "box",
            "layout": "horizontal",
            "contents": [
                {"type": "text", "text": p["name"], "flex": 3, "size": "sm"},
                {"type": "text", "text": f"${p['price']}", "flex": 2, "size": "sm", "align": "center"},
                {"type": "text", "text": str(p["stock"]), "flex": 1, "size": "sm", "align": "end", "color": stock_color},
            ],
        })
        if i < len(products) - 1:
            rows.append({"type": "separator", "margin": "sm"})

    flex = {
        "type": "flex",
        "altText": "📦 庫存一覽",
        "contents": {
            "type": "bubble",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {"type": "text", "text": "📦 庫存一覽", "weight": "bold", "size": "lg"},
                ],
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "contents": [
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "contents": [
                            {"type": "text", "text": "品名", "flex": 3, "size": "xs", "color": "#aaaaaa", "weight": "bold"},
                            {"type": "text", "text": "價格", "flex": 2, "size": "xs", "color": "#aaaaaa", "weight": "bold", "align": "center"},
                            {"type": "text", "text": "庫存", "flex": 1, "size": "xs", "color": "#aaaaaa", "weight": "bold", "align": "end"},
                        ],
                    },
                    {"type": "separator", "margin": "sm"},
                    *rows,
                ],
            },
        },
    }
    reply_message(token, [flex])


# ══════════════════════════════════════════════════════════
#  功能：賒帳一覽
# ══════════════════════════════════════════════════════════
def _show_debts(token: str):
    conn = get_db()
    members = conn.execute(
        "SELECT name, total_debt FROM members ORDER BY name"
    ).fetchall()
    conn.close()

    if not members:
        reply_message(token, [_text("目前沒有族人資料")])
        return

    lines = ["【族人賒帳一覽】\n"]
    for m in members:
        status = f"${m['total_debt']}" if m["total_debt"] > 0 else "無欠款 ✅"
        lines.append(f"• {m['name']}：{status}")

    reply_message(token, [_text("\n".join(lines))])

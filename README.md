# 部落誠實商店 Tribal Shop

一套為部落小店設計的自助結帳系統。顧客掃描商品、確認購物車、並留下照片作為交易紀錄；店主則透過 LINE 即時收到每一筆交易通知。

## 專案背景

部落地區的小型商店常採「誠實商店」經營型態 — 無人看店、靠顧客自助結帳。本專案目標是把這個信任機制數位化：在保留原本互信精神的同時，讓店主能掌握庫存與帳務，並降低人為計算錯誤。

## 技術棧

**Backend**
- Python  / FastAPI
- Supabase（Postgres）為主資料庫，本地 SQLite 作為斷線備援
- LINE Messaging API（line-bot-sdk）

**Frontend**
- React + Vite 
- Tailwind CSS 3

**Testing**
- Playwright（E2E）

## 系統架構

```
┌────────────────┐         ┌─────────────────┐         ┌──────────────┐
│  React SPA     │ ──────▶ │  FastAPI 後端    │ ──────▶ │  Supabase    │
│  (結帳流程 UI)  │  REST   │  (路由 / 服務層) │         │  (Postgres)  │
└────────────────┘         └─────────────────┘         └──────────────┘
                                    │  斷線時 fallback        │
                                    ▼                        │
                            ┌──────────────┐  ◀── 啟動時同步 ──┘
                            │ SQLite cache │
                            └──────────────┘
                                    │
                                    ▼
                            ┌──────────────┐
                            │  LINE Bot    │ ── 推播交易通知給店主
                            └──────────────┘
```

### 資料庫雙後端設計

部落門市網路品質不穩，因此資料層做了 graceful degradation：

- 啟動時優先連 Supabase Postgres，連不上時自動切換本地 SQLite
- 連到 Postgres 時，會把 `products` / `member` 同步到本地 cache，確保斷線後仍可結帳
- 對外提供統一的 `DBConnection` / `DBCursor` 介面，業務程式只寫一份 SQL（用 `%s` placeholder，wrapper 在 SQLite 模式下自動轉成 `?`）

後端採路由 / 服務分層：路由層處理 HTTP 與資料驗證（Pydantic），服務層封裝 LINE 通知等外部整合。

## 結帳流程

前端是一個多步驟 wizard，狀態以 React Context（`CheckoutContext`）集中管理：

```
WELCOME → AUTH → INSTRUCTION → SCAN → CART
    → EVIDENCE PHOTO → END
```

每一步都是獨立路由（`/welcome`、`/auth`、`/scan` …），支援前後切換並保留進度。送出訂單時以 `multipart/form-data` 一次帶上 JSON 訂單資料與證據照片。

## 主要功能

- **商品掃描** — 透過裝置相機辨識商品並自動加入購物車
- **付款方式** — 賒帳（後續由管理介面銷帳）
- **LINE 通知** — 每筆訂單自動推播給店主（含商品明細、金額、結帳照片）
- **管理 API** — 商品 CRUD、價格調整、賒帳銷帳

## API

| Method | Endpoint                              | 說明                          |
| ------ | ------------------------------------- | ----------------------------- |
| GET    | `/api/products`                       | 取得商品清單                   |
| POST   | `/api/checkout`                       | 送出訂單（multipart）         |
| POST   | `/api/admin/repay`                    | 賒帳銷帳                      |
| POST   | `/api/admin/product`                  | 新增商品                      |
| PUT    | `/api/admin/product/{name}/price`     | 更新商品價格                  |
| GET    | `/api/admin/product/{name}`           | 查詢單一商品                  |

`/api/checkout` 使用 multipart：訂單 JSON 字串放在 `data` 欄位，證據照片放在 `image` 欄位。

## 專案結構

```
tribal-shop/
├── backend/
│   ├── main.py                  # FastAPI 入口、路由掛載
│   ├── app/
│   │   ├── routers/             # products / checkout / admin / vision / line_webhook
│   │   ├── services/            # LINE Bot 通知
│   │   ├── models.py            # Pydantic 請求模型
│   │   └── database.py          # Supabase / SQLite 雙後端 wrapper
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/               # 各步驟頁面（9 步）
│       ├── context/             # CheckoutContext（共用流程狀態）
│       └── App.jsx              # React Router 設定
├── e2e/                         # Playwright 測試
└── README.md
```

## 啟動方式

### Backend

```bash
cd backend
python3 -m venv ../.venv
source ../.venv/bin/activate     # Windows: ..\.venv\Scripts\activate
pip install -r requirements.txt
python3 main.py                  # http://127.0.0.1:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                      # Vite dev server，自動 proxy 到後端
```

### E2E 測試

```bash
npm install                      # 在專案根目錄
npx playwright test
```


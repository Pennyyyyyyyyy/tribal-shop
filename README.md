# 飛鼠商店 Tribal Shop（樹莓派現場運行版本）

本分支（`rasberryVersion`）專門精簡給**店內樹莓派實體 POS 機**使用。

---

## 系統整體架構

本系統採用「**本地高速辨識 + 雲端無伺服器處理**」架構：

```
┌────────────────────────────────────────────────────────┐
│             🏪 店內樹莓派 (Raspberry Pi)               │
│                                                        │
│  ┌────────────────────────┐   ┌─────────────────────┐  │
│  │ React 前端 POS 觸控螢幕 │   │ FastAPI 本地後端     │  │
│  │ (http://localhost:5173)│   │ (http://127.0.0.1:8000)│
│  └───────────┬────────────┘   └──────────▲──────────┘  │
│              │ (結帳/商品)                │ (影像辨識) │
│              │                            │            │
│              │                     📷 店內外接鏡頭     │
└──────────────┼────────────────────────────┼────────────┘
               │ 外網 HTTPS                 │
               ▼                            │
┌──────────────────────────────┐            │
│   Cloudflare Worker (雲端)   │            │
│  flying-squirrel-shop.com    │            │
└──────────────┬───────────────┘            │
               │                            │
               ▼                            │
┌──────────────────────────────┐            │
│       Supabase (雲端 DB)      │ ◀──────────┘
│  - 商品/訂單/交易記錄        │ (pgvector 特徵比對)
│  - Storage 結帳照片          │
└──────────────────────────────┘
```

- **樹莓派只負責**：
  1. 連接店內實體 USB 鏡頭，透過本地 FastAPI 執行 EfficientNet 影像特徵萃取。
  2. 運行 React 前端（提供現場顧客觸控結帳）。
- **雲端 Worker 負責**：
  - 商品清單、結帳扣庫存、LINE 訊息推播、店長手機後台管理（樹莓派不需跑 Worker）。

---

## 專案結構（樹莓派精簡版）

```
tribal-shop/
├── backend/                  # 本地 FastAPI 影像辨識服務
│   ├── main.py               # 服務進入點 (port 8000)
│   ├── app/
│   │   ├── ai/               # EfficientNet 模型與推論
│   │   ├── routers/vision.py # 鏡頭擷取與商品比對 API
│   │   └── database.py       # 本地 SQLite 備援
│   └── requirements.txt
├── frontend/                 # 現場 POS 前端介面
│   ├── src/                  # 結帳流程 UI
│   ├── .env                  # 前端環境變數 (指到本地 8000 + 雲端 Worker)
│   └── package.json
├── start_pi.sh               # 樹莓派一鍵啟動腳本 (同時起後端與前端)
└── README.md
```

---

## 樹莓派快速啟動

### 1. 初次安裝依賴

```bash
# 後端 Python 依賴
cd backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt

# 前端 Node 依賴
cd ../frontend
npm install
npm run build   # 編譯生產環境靜態檔
```

### 2. 環境設定檔 (`frontend/.env`)
確認 `frontend/.env` 包含以下內容：
```ini
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WORKER_URL=https://flying-squirrel-shop.com
```

### 3. 一鍵啟動

在專案根目錄執行：
```bash
./start_pi.sh
```
此腳本會自動：
1. 在背景啟動本地 FastAPI 後端 (`http://127.0.0.1:8000`)
2. 啟動前端 POS 介面 (`http://localhost:5173`)
3. 按 `Ctrl + C` 可一次關閉所有服務。

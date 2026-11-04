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
  1. 連接店內實體 USB 鏡頭，透過本地 FastAPI 執行 EfficientNet ONNX 影像特徵萃取。
  2. 監聽實體投幣機脈衝訊號（BCM 27 / Pin 13），即時推播投幣金額至前端。
  3. 運行 React 前端（提供現場顧客觸控結帳）。
- **雲端 Worker 負責**：
  - 商品清單、結帳扣庫存、LINE 訊息推播、店長手機後台管理（樹莓派不需跑 Worker）。

---

## 專案結構（樹莓派精簡版）

```
tribal-shop/
├── backend/                  # 本地 FastAPI 影像辨識與投幣機服務
│   ├── main.py               # 服務進入點 (port 8000)
│   ├── embedding_worker.py   # 自動向量化背景排程服務
│   ├── app/
│   │   ├── ai/               # EfficientNet ONNX 模型與推論
│   │   ├── hardware/         # 樹莓派 GPIO 27 投幣機中斷監聽
│   │   └── routers/          # vision 鏡頭比對與 payment 投幣 WebSocket
│   └── requirements.txt      # 輕量化相依套件 (ONNX Runtime + Pillow + FastAPI)
├── frontend/                 # 現場 POS 前端介面
│   ├── src/                  # 結帳流程 UI
│   ├── .env                  # 前端環境變數 (指到本地 8000 + 雲端 Worker)
│   └── package.json
├── start_pi.sh               # 樹莓派一鍵啟動腳本 (同時起後端、前端與硬體監聽)
├── DEPLOYMENT_PI.md          # 樹莓派詳細部署與防雷手冊
└── README.md
```

---

## 樹莓派快速啟動

詳細樹莓派連線部署與防雷手冊請參閱 📄 [DEPLOYMENT_PI.md](DEPLOYMENT_PI.md)。

### 1. 初次安裝依賴（統一在專案根目錄，防範多重 venv 衝突）

```bash
# 後端 Python 依賴（在專案根目錄建立唯一 .venv）
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# 前端 Node 依賴與打包
cd frontend
npm install
npm run build   # 編譯生產環境靜態檔
cd ..
```

### 2. 環境設定檔 (`.env`)

系統在初次執行 `start_pi.sh` 時會自動由範本生成，亦可手動建立：
- `backend/.env` (由 `backend/.env.example` 複製，設定 Supabase 連線)
- `frontend/.env` (由 `frontend/.env.example` 複製，指向本地後端與雲端 Worker)

### 3. 一鍵啟動

在專案根目錄執行：
```bash
./start_pi.sh
```
此腳本會自動：
1. 檢測並自動套用專案根目錄的唯一 `.venv` 虛擬環境
2. 在背景啟動本地 FastAPI 後端 (`http://127.0.0.1:8000`) 與 Embedding Worker
3. 監聽樹莓派 GPIO 27 投幣機脈衝
4. 啟動前端 POS 介面 (`http://localhost:5173`)
5. 按 `Ctrl + C` 可一次乾淨關閉所有服務。

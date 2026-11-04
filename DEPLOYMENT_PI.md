# 飛鼠商店 (Tribal Shop) 樹莓派現場部署與運維手冊

本文件專為**店內樹莓派實體機**（Raspberry Pi 4 / 5，Raspberry Pi OS 64-bit）撰寫，詳細規範系統初始化、相依套件安裝、單一虛擬環境管理（避免多重 venv 衝突）以及後續代碼更新流程。

---

## 📌 目錄
1. [環境需求與防雷原則](#1-環境需求與防雷原則)
2. [首次部署流程（透過 Raspberry Connect Shell）](#2-首次部署流程透過-raspberry-connect-shell)
3. [多重 venv 衝突防範與一鍵修復](#3-多重-venv-衝突防範與一鍵修復)
4. [後續代碼更新與再次部署 (SOP)](#4-後續代碼更新與再次部署-sop)
5. [開機自動啟動設定 (Systemd Service)](#5-開機自動啟動設定-systemd-service)
6. [常見問題排查 (Troubleshooting)](#6-常見問題排查-troubleshooting)

---

## 1. 環境需求與防雷原則

### 硬體與系統
- **硬體**：Raspberry Pi 4 (建議 4GB/8GB RAM) 或 Raspberry Pi 5。
- **作業系統**：Raspberry Pi OS 64-bit (Debian 12 Bookworm 建議)。
- **周邊設備**：USB 攝影鏡頭、硬體投幣機 (訊號線接於 **BCM 27 / 實體 Pin 13**)。

### ⚠️ 防雷三大原則
1. **【唯一 venv 原則】**：**整個專案只允許在專案根目錄 (`~/tribal-shop/.venv`) 建立一個虛擬環境**。切勿在 `backend/` 目錄下再次執行 `python -m venv .venv`，避免出現多重環境導致套件裝在 A、執行卻在 B。
2. **【PEP 668 規範】**：Debian Bookworm 預設禁止在系統 Python 直接 `pip install`，所有 Python 指令請一律在 `.venv` 內或透過 `.venv/bin/pip` 執行。
3. **【Node 版本規範】**：前端 Vite 7 需要 **Node.js >= 18**（建議安裝 Node.js 20 LTS）。

---

## 2. 首次部署流程（透過 Raspberry Connect Shell）

請依序在 Raspberry Connect Shell 中執行以下指令：

### Step 1: 安裝樹莓派系統必備工具與 Node.js 20

```bash
# 1. 更新套件清單並安裝 Python 與系統工具 (包含 OpenCV 影像處理所需的 libglib 與 libgl)
sudo apt update && sudo apt install -y git python3 python3-venv python3-pip curl libpq-dev libglib2.0-0 libgl1

# 2. 安裝 Node.js 20.x LTS (若樹莓派已安裝 Node 18+ 可跳過此區塊)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 檢查版本 (確認 python >= 3.11, node >= 18)
python3 --version
node -v
npm -v
```

---

### Step 2: 下載專案代碼

```bash
cd ~
# Clone 樹莓派專屬分支
git clone -b rasberryVersion https://github.com/Alpacamymac/tribal-shop.git
cd tribal-shop
```

> **提示**：若 GitHub 倉庫需要權限，請使用 GitHub Personal Access Token (PAT) 或先行設定 SSH Key。

---

### Step 3: 初始化唯一 Python 虛擬環境 (後端)

```bash
# 確保位於專案根目錄 ~/tribal-shop
cd ~/tribal-shop

# 1. 清理可能誤建的子目錄 venv
rm -rf backend/.venv

# 2. 在根目錄建立唯一的 .venv
python3 -m venv .venv

# 3. 啟用環境並升級 pip
source .venv/bin/activate
pip install --upgrade pip

# 4. 安裝後端所需依賴 (ONNX Runtime、OpenCV Headless 切割演算法、FastAPI、psycopg2 等輕量高速套件)
pip install -r backend/requirements.txt
```

> 💡 **硬體 GPIO 支援說明**：
> `backend/requirements.txt` 內已預先納入 `rpi-lgpio` 相容層（支援 Raspberry Pi 4 與 5），執行 `pip install -r backend/requirements.txt` 時會在 Linux 環境自動安裝，無須額外手動安裝。

---

### Step 4: 安裝前端依賴並打包生產環境 (前端)

```bash
cd ~/tribal-shop/frontend

# 安裝 Node 套件
npm install

# 編譯生產環境靜態檔案 (dist/)
npm run build

# 回到專案根目錄
cd ~/tribal-shop
```

---

### Step 5: 檢查環境設定檔 (.env)

專案已內建自動初始化機制，第一次可手動檢查確認：

```bash
cd ~/tribal-shop

# 若無 .env 則由範本複製
cp -n backend/.env.example backend/.env
cp -n frontend/.env.example frontend/.env
```

- `backend/.env`：包含 Supabase PostgreSQL 連線網址 (`DATABASE_URL` / `SUPABASE_DB_URL`)。
- `frontend/.env`：包含本地後端 `http://127.0.0.1:8000` 與雲端 Worker 接口網址。

---

### Step 6: 啟動專案

專案提供了一鍵啟動腳本 [`start_pi.sh`](file:///Users/alpaca/Desktop/Desktop/壁磚/tribal-shop/start_pi.sh)，會同時帶起：
- **FastAPI 影像辨識後端** (`http://127.0.0.1:8000`)
- **Embedding Worker** (背景自動向量化任務)
- **投幣機 GPIO 監聽服務** (BCM 27)
- **React POS 現場觸控畫面** (`http://localhost:5173`)

```bash
cd ~/tribal-shop
chmod +x start_pi.sh
./start_pi.sh
```

如需手動停止，在終端按下 `Ctrl + C`，腳本會自動關閉後端與前端行程。

---

## 3. 多重 venv 衝突防範與一鍵修復

### 為什麼會出現重複的 venv？
常見原因：
1. 開發者進入 `cd backend` 後下意識執行 `python3 -m venv .venv`，在 `backend/.venv` 產生了第二個環境。
2. 根目錄有一個 `.venv`，子目錄又有一個 `backend/.venv`，導致 `pip install` 裝在一處，而啟動腳本讀取另一處，拋出 `ModuleNotFoundError`。

### 系統防護機制
啟動腳本 [`start_pi.sh`](file:///Users/alpaca/Desktop/Desktop/壁磚/tribal-shop/start_pi.sh) 內已加入自動防護：
- 當偵測到同時存在多個 venv 時，會主動輸出警告，並**強制以根目錄 `.venv` 為準**。

### 一鍵檢查與清理指令
在 `~/tribal-shop` 執行以下指令，可快速清查並修復：

```bash
# 1. 檢查是否存在重複環境
find . -maxdepth 3 -name "pyvenv.cfg"

# 2. 若發現 backend/.venv，直接刪除清理：
rm -rf ~/tribal-shop/backend/.venv

# 3. 確保套件完整安裝在根目錄環境：
~/tribal-shop/.venv/bin/pip install -r ~/tribal-shop/backend/requirements.txt
```

---

## 4. 後續代碼更新與再次部署 (SOP)

當你在 GitHub 更新代碼後，回到樹莓派執行以下更新流程：

```bash
# 1. 進入專案根目錄
cd ~/tribal-shop

# 2. 拉取最新代碼
git pull origin rasberryVersion

# 3. 更新 Python 依賴 (直接使用專案唯一 .venv/bin/pip，無需切換目錄)
.venv/bin/pip install -r backend/requirements.txt

# 4. 更新前端並重新編譯
cd frontend
npm install
npm run build
cd ..

# 5. 重新啟動服務
./start_pi.sh
```

---

## 5. 開機自動啟動設定 (Systemd Service)

若希望樹莓派通電開機後**自動在背景啟動服務**，可設定 systemd 守護行程：

```bash
sudo nano /etc/systemd/system/tribal-shop.service
```

貼上以下內容（假設樹莓派使用者名稱為 `pi`，若是其他帳號請置換 `pi`）：

```ini
[Unit]
Description=Tribal Shop POS System
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/tribal-shop
ExecStart=/bin/bash /home/pi/tribal-shop/start_pi.sh
Restart=always
RestartSec=5
KillMode=mixed
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

啟用並啟動服務：
```bash
sudo systemctl daemon-reload
sudo systemctl enable tribal-shop.service
sudo systemctl start tribal-shop.service
```

常用管理指令：
```bash
# 查看運行狀態與日誌
sudo systemctl status tribal-shop.service
journalctl -u tribal-shop.service -f -n 50

# 重啟服務
sudo systemctl restart tribal-shop.service

# 停止服務
sudo systemctl stop tribal-shop.service
```

---

## 6. 常見問題排查 (Troubleshooting)

### Q1: 啟動後提示 Port 8000 或 5173 已被佔用
- **原因**：先前運行的伺服器未完全退出。
- **解法**：
  ```bash
  # 查詢並強制關閉佔用該 Port 的行程
  sudo fuser -k 8000/tcp
  sudo fuser -k 5173/tcp
  # 或使用 pkill 清理
  pkill -f "python.*main.py"
  pkill -f "serve -s dist"
  ```

### Q2: 提示 `externally-managed-environment` 錯誤
- **原因**：未使用虛擬環境直接執行全域 `pip install`。
- **解法**：務必先執行 `source .venv/bin/activate` 或直接使用 `.venv/bin/pip install ...`。

### Q3: 鏡頭無畫面或出現 Permission Denied
- **原因**：目前使用者未被加入 `video` 權限群組。
- **解法**：
  ```bash
  sudo usermod -aG video $USER
  # 重新登入後生效，並檢查鏡頭代號是否為 /dev/video0
  ls -la /dev/video*
  ```

### Q4: 投幣機沒有反應
- **原因**：接線鬆脫或 GPIO 權限問題。
- **解法**：
  1. 確認硬體投幣機的訊號線 (COIN) 正確接至 **BCM GPIO 27 (實體 Pin 13)**，且投幣機 GND 與樹莓派 GND 共地。
  2. 將使用者加入 gpio 群組：
     ```bash
     sudo usermod -aG gpio $USER
     ```
  3. 可透過瀏覽器或 curl 測試軟體模擬投幣：
     ```bash
     curl -X POST "http://127.0.0.1:8000/api/mock-coin?amount=10"
     ```

### Q5: 啟動時報錯 `ModuleNotFoundError: No module named 'cv2'`
- **原因**：拉取最新代碼後，虛擬環境尚未安裝新增的 `opencv-python-headless` 套件（白底多物件切割演算法核心依賴）。
- **解法**：在樹莓派終端機執行以下指令更新虛擬環境套件：
  ```bash
  cd ~/tribal-shop  # (若為巢狀目錄請依實際路徑進入，例如 ~/tribal-shop/tribal-shop)
  # 啟用虛擬環境並安裝
  source .venv/bin/activate
  pip install -r backend/requirements.txt
  # 或直接指定 .venv/bin/pip 安裝：
  .venv/bin/pip install -r backend/requirements.txt
  ```
  若啟動時拋出 `libGL.so` 或 `libgthread` 相關缺失錯誤，請補裝系統庫：
  ```bash
  sudo apt update && sudo apt install -y libglib2.0-0 libgl1
  ```

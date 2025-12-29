1. 安裝系統組件 (必做)

本專案使用 Whisper 進行音訊處理，必須安裝 ffmpeg：

Windows: 使用 Chocolatey 安裝 choco install ffmpeg 或下載執行檔並加入環境變數。

macOS: brew install ffmpeg

Linux: sudo apt update && sudo apt install ffmpeg

2. 複製專案與安裝套件

Bash
# 複製專案
git clone <你的GitHub專案網址>
cd <專案資料夾名稱>

# 建立虛擬環境
python -m venv venv

# 啟動虛擬環境 (Windows)
venv\Scripts\activate
# 啟動虛擬環境 (Mac/Linux)
source venv/bin/activate

# 安裝必要套件
pip install fastapi uvicorn openai-whisper python-multipart

# 啟動伺服器
Bash
python main.py
啟動後，API 將運行於：http://127.0.0.1:8000

1. 提交結帳請求 (用戶端)

路徑: POST /submit-checkout

格式: multipart/form-data

參數:

image: 商品照片 (File)

audio: 結帳語音 (File)

video: 交易影片 (File)

user_id: 使用者 ID (String)

2. 審核交易 (店長端)

路徑: POST /approve-transaction/{pending_id}

功能: 確認交易並扣除庫存。

3. 查看系統狀態

路徑: GET /check-status

功能: 回傳目前所有商品庫存及所有訂單紀錄。

4. 檔案調閱
api測試：http://127.0.0.1:8000/docs

路徑格式: http://127.0.0.1:8000/uploads/{類別}/{檔名}

範例: http://127.0.0.1:8000/uploads/images/test.jpg

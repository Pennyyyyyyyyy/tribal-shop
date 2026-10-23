#!/bin/bash
# ==============================================================
# 飛鼠商店 (Tribal Shop) - 樹莓派現場啟動腳本
# ==============================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "🌲 正在啟動飛鼠商店 (樹莓派現場系統)..."

# 1. 檢查 Python 虛擬環境 (防止多個重複 venv 造成衝突)
if [ -d "$DIR/.venv" ] && [ -d "$DIR/backend/.venv" ]; then
    echo "⚠️  警告：偵測到多個虛擬環境 ($DIR/.venv 與 $DIR/backend/.venv)！"
    echo "👉 系統將統一使用專案根目錄的 $DIR/.venv。"
    echo "💡 建議刪除 backend/.venv (執行 rm -rf backend/.venv) 以免套件版本混淆。"
    PYTHON_EXEC="$DIR/.venv/bin/python"
elif [ -d "$DIR/.venv" ]; then
    PYTHON_EXEC="$DIR/.venv/bin/python"
elif [ -d "$DIR/backend/.venv" ]; then
    echo "ℹ️  使用 backend/.venv 虛擬環境 (建議後續統一遷移至根目錄 .venv)"
    PYTHON_EXEC="$DIR/backend/.venv/bin/python"
else
    echo "⚠️ 找不到 .venv，使用系統 python3"
    PYTHON_EXEC="python3"
fi

# 1.1 檢查環境變數檔案 (.env)
if [ ! -f "$DIR/backend/.env" ] && [ -f "$DIR/backend/.env.example" ]; then
    echo "⚠️ 找不到 backend/.env，自動由 backend/.env.example 建立預設檔..."
    cp "$DIR/backend/.env.example" "$DIR/backend/.env"
fi

if [ ! -f "$DIR/frontend/.env" ] && [ -f "$DIR/frontend/.env.example" ]; then
    echo "⚠️ 找不到 frontend/.env，自動由 frontend/.env.example 建立預設檔..."
    cp "$DIR/frontend/.env.example" "$DIR/frontend/.env"
fi

# 2. 啟動 FastAPI 本地後端 (鏡頭影像辨識)
echo "🐍 啟動本地 FastAPI 後端 (port 8000)..."
cd "$DIR/backend"
$PYTHON_EXEC main.py &
BACKEND_PID=$!
echo "   後端 PID: $BACKEND_PID"

# 3. 啟動前端 POS 結帳介面
echo "⚛️  啟動前端 POS 介面..."
cd "$DIR/frontend"

# 若已有 dist 且安裝了 serve，優先用輕量 serve，否則用 npm run dev
if [ -d "dist" ] && command -v npx >/dev/null 2>&1; then
    echo "   使用生產環境打包 (dist) 啟動於 port 5173..."
    npx --yes serve -s dist -l 5173 &
    FRONTEND_PID=$!
else
    echo "   使用開發模式 npm run dev..."
    npm run dev -- --host &
    FRONTEND_PID=$!
fi
echo "   前端 PID: $FRONTEND_PID"

echo "=============================================================="
echo "✅ 飛鼠商店現場系統已啟動！"
echo "   - 本地辨識後端: http://localhost:8000"
echo "   - 現場 POS 畫面: http://localhost:5173"
echo "   - 雲端 Worker 接口: https://flying-squirrel-shop-staging.autocheckout2025.workers.dev"
echo "   按 Ctrl+C 可一鍵關閉所有服務"
echo "=============================================================="

# 捕捉中斷信號，同時退出後端與前端
trap "echo '🛑 正在停止服務...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM EXIT
wait

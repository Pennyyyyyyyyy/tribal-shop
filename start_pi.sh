#!/bin/bash
# ==============================================================
# 飛鼠商店 (Tribal Shop) - 樹莓派現場啟動腳本
# ==============================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "🌲 正在啟動飛鼠商店 (樹莓派現場系統)..."

# 1. 檢查 Python 虛擬環境 (優先檢測已啟用的 venv、當前目錄、或上一層目錄)
if [ -n "$VIRTUAL_ENV" ] && [ -f "$VIRTUAL_ENV/bin/python" ]; then
    echo "🐍 使用當前終端已啟用的虛擬環境: $VIRTUAL_ENV"
    PYTHON_EXEC="$VIRTUAL_ENV/bin/python"
elif [ -d "$DIR/.venv" ] && [ -d "$DIR/backend/.venv" ]; then
    echo "⚠️  警告：偵測到多個虛擬環境 ($DIR/.venv 與 $DIR/backend/.venv)！"
    echo "👉 系統將統一使用專案根目錄的 $DIR/.venv。"
    echo "💡 建議刪除 backend/.venv (執行 rm -rf backend/.venv) 以免套件版本混淆。"
    PYTHON_EXEC="$DIR/.venv/bin/python"
elif [ -d "$DIR/.venv" ]; then
    PYTHON_EXEC="$DIR/.venv/bin/python"
elif [ -d "$DIR/../.venv" ]; then
    echo "🐍 在父層目錄找到虛擬環境: $DIR/../.venv"
    PYTHON_EXEC="$DIR/../.venv/bin/python"
elif [ -d "$DIR/backend/.venv" ]; then
    echo "ℹ️  使用 backend/.venv 虛擬環境 (建議後續統一遷移至根目錄 .venv)"
    PYTHON_EXEC="$DIR/backend/.venv/bin/python"
else
    echo "⚠️ 找不到 .venv，使用系統 python3"
    PYTHON_EXEC="python3"
fi

# 1.1 檢查核心 Python 相依套件 (若缺 cv2 則自動安裝 requirements.txt)
if ! $PYTHON_EXEC -c "import cv2" >/dev/null 2>&1; then
    echo "📦 偵測到環境中缺少 cv2 (opencv-python-headless)，正在為 $PYTHON_EXEC 安裝相依套件..."
    $PYTHON_EXEC -m pip install -r "$DIR/backend/requirements.txt" || {
        echo "⚠️ 自動安裝失敗，請手動執行: $PYTHON_EXEC -m pip install -r backend/requirements.txt"
    }
fi

# 1.2 檢查環境變數檔案 (.env)
if [ ! -f "$DIR/backend/.env" ] && [ -f "$DIR/backend/.env.example" ]; then
    echo "⚠️ 找不到 backend/.env，自動由 backend/.env.example 建立預設檔..."
    cp "$DIR/backend/.env.example" "$DIR/backend/.env"
fi

if [ ! -f "$DIR/frontend/.env" ] && [ -f "$DIR/frontend/.env.example" ]; then
    echo "⚠️ 找不到 frontend/.env，自動由 frontend/.env.example 建立預設檔..."
    cp "$DIR/frontend/.env.example" "$DIR/frontend/.env"
fi

# 1.3 設定 ARM CPU 指令集相容環境變數 (防範 OpenBLAS / ATen 誤判指令集導致無效指令 SIGILL)
export ATEN_CPU_CAPABILITY=default
export OPENBLAS_CORETYPE=ARMV8
export OMP_NUM_THREADS=2

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

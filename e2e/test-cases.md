# E2E Test Cases — 部落誠實商店

Base URL: `http://localhost:5173/?e2e=true`
測試工具: MCP Playwright
前置條件: 後端 (`cd backend && python3 main.py`) 與前端 (`cd frontend && npm run dev`) 皆已啟動

---

## Test 1: 族人結帳 + LINE 通知（含語音轉文字 & 存證照片）

驗證族人完整結帳流程，結帳後後端：
- 用 Whisper 將錄音轉文字
- 發送 LINE 通知（含商品明細 + 錄音轉文字內容）
- 若有設定 `SERVER_BASE_URL`，LINE 通知會附帶存證照片

| 步驟 | 操作 | 預期結果 |
|------|------|----------|
| 1 | 開啟 `/?e2e=true` | 看到「Welcome!」 |
| 2 | 點擊 `[data-testid="btn-tribal"]` | 進入 AUTH (Step 2)，看到「賒帳身份驗證」 |
| 3 | 依序點擊 `keypad-1`, `keypad-2`, `keypad-3`, `keypad-4` | 密碼欄顯示 ●●●● |
| 4 | 點擊 `[data-testid="btn-confirm"]` | 進入 INSTRUCTION (Step 3) |
| 5 | 等待 3 秒 | 自動跳轉到 SCAN (Step 4) |
| 6 | 等待商品辨識，若出現確認彈窗點擊 `btn-confirm-item` | 購物車出現商品 |
| 7 | 點擊 `[data-testid="btn-view-cart"]` | 進入 CART (Step 5)，顯示商品與總金額 |
| 8 | 點擊 `[data-testid="btn-checkout"]` | 進入 EVIDENCE_PHOTO (Step 7) |
| 9 | 點擊 `[data-testid="btn-skip-photo"]` | 產生 mock 照片，「下一步：錄音」啟用 |
| 10 | 點擊 `[data-testid="btn-next-audio"]` | 進入 EVIDENCE_AUDIO (Step 8) |
| 11 | 點擊 `[data-testid="btn-skip-audio"]` | 產生 mock 錄音，「送出」按鈕啟用 |
| 12 | 點擊 `[data-testid="btn-submit-evidence"]` | 按鈕顯示「送出中...」（後端做語音轉文字） |
| 13 | 等待完成 | **成功到達 END (Step 9)，顯示「Thank you!」** |
| 14 | 檢查後端 log | **印出 `[Checkout] 開始語音轉文字`** |
| 15 | 檢查後端 log | **印出 `[LINE] 圖片已上傳: https://iili.io/...`** |
| 16 | 檢查後端 log | **印出 `[LINE] 已發送廣播通知（含 2 則訊息）`**（文字+圖片） |

### LINE 通知內容格式（實際錄音時）
```
【結帳通知】
類型: 族人賒帳
商品:
  餅乾 x1
總金額: $50

🎙 錄音內容：
「我是小明，我買了一個餅乾」
```

### 後端處理流程
1. 接收 FormData（cart_items, total_amount, photo, audio）
2. 儲存照片到 `uploads/images/`
3. 儲存錄音到 `uploads/audio/`
4. **Whisper base 模型語音轉文字**（語言: zh）
5. 扣庫存 + 建立訂單
6. **上傳存證照片到 freeimage.host 取得公開 HTTPS URL**
7. 發送 LINE 廣播通知（文字 + 錄音轉譯 + 存證照片）
8. 若庫存 < 5 則額外發送庫存警報

### 備註
- E2E mock 錄音為靜音檔，轉文字結果為空（預期行為）
- 照片自動上傳到 freeimage.host 圖床，不需要額外設定公開 URL

---

## Test 2: 遊客 LinePay 結帳

驗證遊客透過 LinePay 結帳流程（不經過存證步驟）。

| 步驟 | 操作 | 預期結果 |
|------|------|----------|
| 1 | 開啟 `/?e2e=true` | 看到「Welcome!」 |
| 2 | 點擊 `[data-testid="btn-guest"]` | 跳過 AUTH，進入 INSTRUCTION (Step 3) |
| 3 | 等待 3 秒 | 自動跳轉到 SCAN (Step 4) |
| 4 | 等待商品辨識並確認加入 | 購物車有商品 |
| 5 | 點擊 `[data-testid="btn-view-cart"]` | 進入 CART (Step 5) |
| 6 | 點擊 `[data-testid="btn-checkout"]` | 進入 PAYMENT (Step 6)，顯示「Line Pay 結帳」 |
| 7 | 點擊 `[data-testid="btn-linepay"]` | 跳出 alert「模擬：已轉 Linepay Money 給飛鼠」 |
| 8 | 接受 alert | **到達 END (Step 9)，顯示「Thank you!」** |

---

## Test 3: 族人密碼錯誤鎖定

驗證密碼輸入錯 3 次後系統鎖定。

| 步驟 | 操作 | 預期結果 |
|------|------|----------|
| 1 | 開啟頁面，點擊 `btn-tribal` | 進入 AUTH |
| 2 | 輸入 `0000`，點擊確認 | 顯示「通關密碼錯誤，第 1 次」 |
| 3 | 輸入 `9999`，點擊確認 | 顯示「第 2 次」 |
| 4 | 輸入 `5555`，點擊確認 | 顯示「系統暫時鎖定」 |
| 5 | 檢查所有按鍵 | **全部 disabled（數字鍵、清除、確認）** |

---

## Test 4: 送出回首頁重置

驗證完成結帳後回到首頁，所有狀態歸零。

| 步驟 | 操作 | 預期結果 |
|------|------|----------|
| 1 | 完成 Test 1 或 Test 2 到 END | 看到「Thank you!」和星星評分 |
| 2 | 點擊第 4 顆星 | 顯示「已給予 4 分」 |
| 3 | 點擊 `[data-testid="btn-final-submit"]` | **回到 WELCOME (Step 1)，顯示「Welcome!」** |

---

## E2E Bypass 機制

URL 加上 `?e2e=true` 會啟用以下跳過按鈕（僅測試用）：

| data-testid | 位置 | 作用 |
|-------------|------|------|
| `btn-skip-photo` | EVIDENCE_PHOTO | 產生 640x480 灰色 canvas mock 照片 |
| `btn-skip-audio` | EVIDENCE_AUDIO | 產生 1 秒靜音 WAV mock 錄音 |

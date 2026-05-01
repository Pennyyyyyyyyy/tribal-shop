/**
 * E2E 測試：族人結帳完整流程 + LINE 通知發送
 *
 * 前置條件：
 *   - 後端運行在 http://127.0.0.1:8000 (cd backend && python main.py)
 *   - 前端運行在 http://localhost:5173 (cd frontend && npm run dev)
 *
 * 流程：WELCOME → AUTH (密碼 1234) → INSTRUCTION → SCAN → CART → EVIDENCE_PHOTO → EVIDENCE_AUDIO → END
 * 使用 ?e2e=true 繞過攝影機與錄音
 *
 * 執行：npx playwright test e2e/line-notification.spec.js
 */

const 
{ test, expect } = require("@playwright/test");

const BASE_URL = "http://localhost:5173";

/**
 * 在 SCAN 頁面等待至少有商品加入購物車。
 * 掃描結果是隨機的：信心度 >= 78% 自動加入，< 78% 需要手動確認。
 * 此 helper 會自動處理手動確認的情境。
 */
async function waitForCartItems(page, minItems = 1, maxWaitMs = 20000) {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    // 如果出現「請確認商品」的確認面板，點擊確認
    const confirmBtn = page.getByTestId("btn-confirm-item");
    if (await confirmBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(500);
    }

    // 檢查購物車數量（header 上的 "購物車 N 項"）
    const header = await page.textContent("header").catch(() => "");
    const match = header.match(/購物車\s*(\d+)\s*項/);
    if (match && parseInt(match[1]) >= minItems) {
      return;
    }

    await page.waitForTimeout(500);
  }

  throw new Error(`Timed out waiting for ${minItems} cart items`);
}

test.describe("族人結帳流程 + LINE 通知", () => {
  test("完整結帳流程：族人驗證 → 掃描 → 拍照/錄音存證 → 送出（觸發 LINE 通知）", async ({
    page,
  }) => {
    // ===== Step 1: WELCOME =====
    await page.goto(`${BASE_URL}?e2e=true`);
    await expect(page.getByText("Welcome!")).toBeVisible();

    // 點擊「族人」
    await page.getByTestId("btn-tribal").click();

    // ===== Step 2: AUTH（密碼 1234）=====
    await expect(page.getByText("賒帳身份驗證")).toBeVisible();

    await page.getByTestId("keypad-1").click();
    await page.getByTestId("keypad-2").click();
    await page.getByTestId("keypad-3").click();
    await page.getByTestId("keypad-4").click();

    const confirmBtn = page.getByTestId("btn-confirm");
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // ===== Step 3: INSTRUCTION（3 秒後自動跳轉）=====
    await expect(page.getByText("請將物品拿到鏡頭前")).toBeVisible();

    // ===== Step 4: SCAN =====
    await expect(page.getByTestId("btn-view-cart")).toBeVisible({
      timeout: 10000,
    });

    // 等待至少 1 件商品加入購物車（自動處理確認面板）
    await waitForCartItems(page, 1);

    // 點擊查看清單
    await page.getByTestId("btn-view-cart").click();

    // ===== Step 5: CART =====
    await expect(page.getByText("購物車清單")).toBeVisible();

    const checkoutBtn = page.getByTestId("btn-checkout");
    await expect(checkoutBtn).toBeEnabled();
    await checkoutBtn.click();

    // ===== Step 7: EVIDENCE_PHOTO =====
    await expect(page.getByText("步驟 1／2：拍照存證")).toBeVisible();

    // 使用 E2E 跳過拍照
    await page.getByTestId("btn-skip-photo").click();

    const nextAudioBtn = page.getByTestId("btn-next-audio");
    await expect(nextAudioBtn).toBeEnabled();
    await nextAudioBtn.click();

    // ===== Step 8: EVIDENCE_AUDIO =====
    await expect(page.getByText("步驟 2／2：錄音存證")).toBeVisible();

    // 使用 E2E 跳過錄音
    await page.getByTestId("btn-skip-audio").click();
    await expect(page.getByTestId("audio-preview")).toBeVisible();

    // 監聽 checkout API 請求
    const checkoutResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/checkout") && resp.status() === 200,
      { timeout: 15000 }
    );

    // 送出（觸發 POST /api/checkout → 後端發送 LINE 通知）
    const submitBtn = page.getByTestId("btn-submit-evidence");
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 驗證 API 回應
    const response = await checkoutResponse;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("success");

    // ===== Step 9: END =====
    await expect(page.getByText("Thank you!")).toBeVisible();
    await expect(
      page.getByText("感謝您的使用，商家會再確認存貨與消費內容")
    ).toBeVisible();
  });

  test("族人驗證失敗：錯誤密碼 3 次鎖定", async ({ page }) => {
    await page.goto(`${BASE_URL}?e2e=true`);
    await page.getByTestId("btn-tribal").click();
    await expect(page.getByText("賒帳身份驗證")).toBeVisible();

    // 第 1 次錯誤
    await page.getByTestId("keypad-0").click();
    await page.getByTestId("keypad-0").click();
    await page.getByTestId("keypad-0").click();
    await page.getByTestId("keypad-0").click();
    await page.getByTestId("btn-confirm").click();
    await expect(page.getByText("第 1 次")).toBeVisible();

    // 第 2 次錯誤
    await page.getByTestId("keypad-1").click();
    await page.getByTestId("keypad-1").click();
    await page.getByTestId("keypad-1").click();
    await page.getByTestId("keypad-1").click();
    await page.getByTestId("btn-confirm").click();
    await expect(page.getByText("第 2 次")).toBeVisible();

    // 第 3 次錯誤 → 鎖定
    await page.getByTestId("keypad-5").click();
    await page.getByTestId("keypad-5").click();
    await page.getByTestId("keypad-5").click();
    await page.getByTestId("keypad-5").click();
    await page.getByTestId("btn-confirm").click();
    await expect(page.getByText("系統暫時鎖定")).toBeVisible();
    await expect(page.getByTestId("btn-confirm")).toBeDisabled();
  });

  test("遊客結帳流程（不需驗證、不需存證）", async ({ page }) => {
    await page.goto(`${BASE_URL}?e2e=true`);

    // 點擊「遊客」→ 直接跳到 INSTRUCTION（跳過 AUTH）
    await page.getByTestId("btn-guest").click();
    await expect(page.getByText("請將物品拿到鏡頭前")).toBeVisible();

    // 等待進入 SCAN
    await expect(page.getByTestId("btn-view-cart")).toBeVisible({
      timeout: 10000,
    });

    // 等待至少 1 件商品加入
    await waitForCartItems(page, 1);

    // 查看清單
    await page.getByTestId("btn-view-cart").click();
    await expect(page.getByText("購物車清單")).toBeVisible();

    // 結帳
    const checkoutBtn = page.getByTestId("btn-checkout");
    await expect(checkoutBtn).toBeEnabled();
    await checkoutBtn.click();

    // 遊客應看到 LINE Pay 結帳頁
    await expect(page.getByText("Line Pay 結帳")).toBeVisible();
  });
});

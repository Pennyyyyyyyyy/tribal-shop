// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * 部落誠實商店 — E2E 結帳流程測試
 *
 * 使用 ?e2e=true 參數繞過相機/錄音權限。
 * 族人驗證密碼：1234
 */

const BASE = "http://localhost:5173/?e2e=true";

// ─── 共用 helper ─────────────────────────────────────────

/** 點拍照辨識按鈕，等辨識結果出現 */
async function scanAndWaitResult(page) {
  await page.getByTestId("btn-scan").click();
  await expect(page.getByText("辨識結果")).toBeVisible({ timeout: 10000 });
}

/** 掃描一個商品並加入購物車 */
async function scanAndAddToCart(page) {
  await scanAndWaitResult(page);
  await page.getByTestId("btn-confirm-item").click();
}

/** 族人登入：輸入 1234 → 確認 */
async function tribalLogin(page) {
  await page.getByTestId("btn-tribal").click();
  await expect(page.getByText("賒帳身份驗證")).toBeVisible();

  for (const d of ["1", "2", "3", "4"]) {
    await page.getByTestId(`keypad-${d}`).click();
  }
  await page.getByTestId("btn-confirm").click();
}

// ─── TEST: 歡迎頁面 ─────────────────────────────────────

test.describe("歡迎頁面", () => {
  test("顯示遊客和族人按鈕", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText("Welcome!")).toBeVisible();
    await expect(page.getByTestId("btn-guest")).toBeVisible();
    await expect(page.getByTestId("btn-tribal")).toBeVisible();
  });

  test("點遊客 → 跳到指示頁", async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId("btn-guest").click();
    await expect(page.getByText("請將物品拿到鏡頭前")).toBeVisible();
  });

  test("點族人 → 跳到身份驗證", async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId("btn-tribal").click();
    await expect(page.getByText("賒帳身份驗證")).toBeVisible();
  });
});

// ─── TEST: 族人身份驗證 ──────────────────────────────────

test.describe("族人身份驗證", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId("btn-tribal").click();
  });

  test("正確密碼 1234 → 進入指示頁", async ({ page }) => {
    for (const d of ["1", "2", "3", "4"]) {
      await page.getByTestId(`keypad-${d}`).click();
    }
    await page.getByTestId("btn-confirm").click();
    await expect(page.getByText("請將物品拿到鏡頭前")).toBeVisible();
  });

  test("錯誤密碼 → 顯示錯誤訊息", async ({ page }) => {
    for (const d of ["1", "1", "1", "1"]) {
      await page.getByTestId(`keypad-${d}`).click();
    }
    await page.getByTestId("btn-confirm").click();
    await expect(page.getByText("通關密碼錯誤")).toBeVisible();
  });

  test("連續 3 次錯誤 → 系統鎖定", async ({ page }) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const d of ["9", "9", "9", "9"]) {
        await page.getByTestId(`keypad-${d}`).click();
      }
      await page.getByTestId("btn-confirm").click();
      if (attempt < 2) {
        await page.getByTestId("btn-clear").click();
      }
    }
    await expect(page.getByText("系統暫時鎖定")).toBeVisible();
    await expect(page.getByTestId("btn-confirm")).toBeDisabled();
  });

  test("清除按鈕可清空密碼", async ({ page }) => {
    await page.getByTestId("keypad-5").click();
    await page.getByTestId("keypad-6").click();
    await page.getByTestId("btn-clear").click();
    // 確認按鈕應為 disabled（密碼長度 < 4）
    await expect(page.getByTestId("btn-confirm")).toBeDisabled();
  });
});

// ─── TEST: 指示頁 → 自動進入掃描 ────────────────────────

test.describe("指示頁", () => {
  test("3 秒後自動跳到掃描頁", async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId("btn-guest").click();
    await expect(page.getByText("請將物品拿到鏡頭前")).toBeVisible();

    // 等待自動跳轉（3 秒 + buffer）
    await expect(page.getByText("Step 4")).toBeVisible({ timeout: 6000 });
  });
});

// ─── TEST: 掃描辨識 ──────────────────────────────────────

test.describe("掃描辨識", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId("btn-guest").click();
    // 等待自動跳到 SCAN
    await expect(page.getByText("Step 4")).toBeVisible({ timeout: 6000 });
  });

  test("顯示拍照辨識按鈕與商品掃描提示", async ({ page }) => {
    await expect(page.getByTestId("btn-scan")).toBeVisible();
    await expect(page.getByText("商品掃描")).toBeVisible();
  });

  test("無相機時 fallback 到模擬資料仍能運作", async ({ page }) => {
    await scanAndWaitResult(page);
    // 應出現商品名和信心度
    await expect(page.getByText("信心度")).toBeVisible();
  });

  test("可確認商品並加入購物車", async ({ page }) => {
    await scanAndAddToCart(page);
    // 購物車應該有商品
    await expect(page.getByText("查看清單")).toBeVisible();
  });

  test("可拒絕商品並重掃", async ({ page }) => {
    await scanAndWaitResult(page);
    await page.getByTestId("btn-reject-item").click();
    // 應回到商品掃描（IDLE）狀態
    await expect(page.getByRole("heading", { name: "商品掃描" })).toBeVisible();
  });

  test("查看清單按鈕進入購物車", async ({ page }) => {
    await scanAndAddToCart(page);
    await page.getByTestId("btn-view-cart").click();
    await expect(page.getByText("購物車清單")).toBeVisible();
  });
});

// ─── TEST: 購物車 ────────────────────────────────────────

test.describe("購物車", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId("btn-guest").click();
    await expect(page.getByText("Step 4")).toBeVisible({ timeout: 6000 });
    await scanAndAddToCart(page);
    await page.getByTestId("btn-view-cart").click();
  });

  test("顯示商品名稱、數量、小計", async ({ page }) => {
    await expect(page.getByText("購物車清單")).toBeVisible();
    await expect(page.getByText("總金額")).toBeVisible();
    await expect(page.getByText("數量")).toBeVisible();
  });

  test("可增減商品數量", async ({ page }) => {
    const increaseBtn = page.getByRole("button", { name: "增加數量" }).first();
    const decreaseBtn = page.getByRole("button", { name: "減少數量" }).first();

    await increaseBtn.click();
    await expect(page.getByText("2").first()).toBeVisible();

    await decreaseBtn.click();
    await expect(page.getByText("1").first()).toBeVisible();
  });

  test("繼續辨識商品按鈕回到掃描", async ({ page }) => {
    await page.getByText("繼續辨識商品").click();
    await expect(page.getByText("Step 4")).toBeVisible();
  });
});

// ─── TEST: 族人完整結帳流程（含拍照存證）─────────────────

test.describe("族人完整結帳流程", () => {
  test("族人登入 → 掃描 → 購物車 → 拍照存證 → 完成", async ({ page }) => {
    await page.goto(BASE);

    // Step 1: 族人登入
    await tribalLogin(page);

    // Step 2: 指示頁 → 自動跳到掃描
    await expect(page.getByText("請將物品拿到鏡頭前")).toBeVisible();
    await expect(page.getByText("Step 4")).toBeVisible({ timeout: 6000 });

    // Step 3: 拍照辨識 → 確認 → 進入購物車
    await scanAndAddToCart(page);
    await page.getByTestId("btn-view-cart").click();
    await expect(page.getByText("購物車清單")).toBeVisible();

    // Step 4: 結帳（族人直接到拍照存證）
    await page.getByTestId("btn-checkout").click();
    await expect(page.getByText("拍照存證")).toBeVisible();

    // Step 5: E2E 跳過拍照
    await page.getByTestId("btn-skip-photo").click();
    await expect(page.getByText("已拍照")).toBeVisible();

    // Step 6: 送出 → 回到首頁
    await page.getByTestId("btn-submit-evidence").click();
    await expect(page.getByText("Welcome!")).toBeVisible({ timeout: 10000 });
  });
});

// ─── TEST: 遊客完整結帳流程（LINE Pay）───────────────────

test.describe("遊客完整結帳流程", () => {
  test("遊客 → 掃描 → 購物車 → LINE Pay → 完成", async ({ page }) => {
    await page.goto(BASE);

    // Step 1: 遊客
    await page.getByTestId("btn-guest").click();

    // Step 2: 等自動跳到掃描
    await expect(page.getByText("Step 4")).toBeVisible({ timeout: 6000 });

    // Step 3: 拍照辨識 → 確認 → 購物車
    await scanAndAddToCart(page);
    await page.getByTestId("btn-view-cart").click();

    // Step 4: 結帳 → LINE Pay 頁面
    await page.getByTestId("btn-checkout").click();
    await expect(page.getByText("Line Pay 結帳")).toBeVisible();

    // Step 5: 處理 alert dialog，點 LINE Pay → 回到首頁
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByTestId("btn-linepay").click();
    await expect(page.getByText("Welcome!")).toBeVisible({ timeout: 10000 });
  });
});

// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * 部落誠實商店 — 食譜推薦 Popup E2E 測試
 *
 * 遊客在購物車按結帳時，依購物車內容顯示三種模式：
 * - promote：有咖啡/冬瓜茶/泡麵任一，但沒有馬告
 * - celebrate：同時有對應商品 + 馬告
 * - educate：三種對應商品都沒有
 *
 * 測試透過 /products 頁面直接加商品，避開攝影機流程。
 * 族人不跳 popup，會直接跳 /evidence。
 */

const BASE = "http://localhost:5173/?e2e=true";

/** 以遊客身份進入商品選擇頁（先點遊客讓 isTribalMember=false） */
async function enterAsGuest(page) {
  await page.goto(BASE);
  await page.getByTestId("btn-guest").click();
  await page.goto("http://localhost:5173/products?e2e=true");
}

/** 以族人身份透過 UI 流程進入 /scan（避免 page.goto 重置 React state） */
async function enterAsTribalToScan(page) {
  await page.goto(BASE);
  await page.getByTestId("btn-tribal").click();
  await page.getByRole("button", { name: "關閉" }).click();
  for (const d of ["1", "2", "3", "4"]) {
    await page.getByTestId(`keypad-${d}`).click();
  }
  await page.getByTestId("btn-confirm").click();
  // /instruction 3 秒後自動跳 /scan
  await expect(page).toHaveURL(/\/scan/, { timeout: 8000 });
}

/** 在 ProductSelectPage 透過商品名稱加入購物車 */
async function addProductByName(page, name) {
  await page.getByTestId(`btn-add-${name}`).click();
}

/** 進購物車並按結帳 */
async function goToCartAndCheckout(page) {
  await page.getByRole("button", { name: "查看清單" }).click();
  await expect(page.getByText("購物車清單")).toBeVisible();
  await page.getByTestId("btn-checkout").click();
}

test.describe("食譜 Popup — promote 模式（有對應商品、無馬告）", () => {
  test("有泡麵 → 跳出馬告炒泡麵食譜", async ({ page }) => {
    await enterAsGuest(page);
    await addProductByName(page, "統一牛肉麵");
    await goToCartAndCheckout(page);

    await expect(
      page.getByRole("heading", { name: "加入馬告讓你的泡麵多一種風味！" })
    ).toBeVisible();
    await expect(page.getByText("馬告炒泡麵")).toBeVisible();
    await expect(page.getByRole("button", { name: "忍痛放棄" })).toBeVisible();
    await expect(page.getByRole("button", { name: /加入馬告/ })).toBeVisible();
  });

  test("有咖啡粉 → 跳出馬告咖啡食譜", async ({ page }) => {
    await enterAsGuest(page);
    await addProductByName(page, "咖啡粉");
    await goToCartAndCheckout(page);

    await expect(
      page.getByRole("heading", { name: "加入馬告讓你的咖啡多一種風味！" })
    ).toBeVisible();
    await expect(page.getByText("馬告咖啡")).toBeVisible();
  });

  test("有冬瓜磚 → 跳出馬告冬瓜茶食譜", async ({ page }) => {
    await enterAsGuest(page);
    await addProductByName(page, "冬瓜磚");
    await goToCartAndCheckout(page);

    await expect(
      page.getByRole("heading", { name: "加入馬告讓你的冬瓜茶多一種風味！" })
    ).toBeVisible();
  });

  test("點忍痛放棄 → 進入拍照存證頁、不加馬告", async ({ page }) => {
    await enterAsGuest(page);
    await addProductByName(page, "統一牛肉麵");
    await goToCartAndCheckout(page);

    await page.getByRole("button", { name: "忍痛放棄" }).click();
    await expect(page).toHaveURL(/\/evidence/);
    await expect(page.getByRole("heading", { name: "拍照存證" })).toBeVisible();
  });

  test("點加入馬告 → 回購物車確認 → 結帳跳拍照存證頁", async ({ page }) => {
    await enterAsGuest(page);
    await addProductByName(page, "統一牛肉麵");
    await goToCartAndCheckout(page);

    await page.getByRole("button", { name: /加入馬告/ }).click();
    // 不直接跳付款頁，停留在購物車讓遊客確認
    await expect(page.getByText("購物車清單")).toBeVisible();
    // 泡麵 32 + 馬告 80 = 112
    await expect(page.getByText(/112/).first()).toBeVisible();

    // 再次結帳 → celebrate popup → 繼續結帳
    await page.getByTestId("btn-checkout").click();
    await page.getByRole("button", { name: /繼續結帳/ }).click();
    await expect(page).toHaveURL(/\/evidence/);
  });
});

test.describe("食譜 Popup — celebrate 模式（已有對應商品+馬告）", () => {
  test("有泡麵 + 馬告 → 顯示慶祝食譜", async ({ page }) => {
    await enterAsGuest(page);
    await addProductByName(page, "統一牛肉麵");
    await page.getByRole("button", { name: "特色商品" }).click();
    await addProductByName(page, "馬告（山胡椒）");
    await goToCartAndCheckout(page);

    await expect(
      page.getByRole("heading", { name: "你知道馬告加入泡麵可以添加更多風味嗎？" })
    ).toBeVisible();
    await expect(page.getByText(/你已經備好所有材料/)).toBeVisible();
  });

  test("按繼續結帳 → 進入拍照存證頁", async ({ page }) => {
    await enterAsGuest(page);
    await addProductByName(page, "統一牛肉麵");
    await page.getByRole("button", { name: "特色商品" }).click();
    await addProductByName(page, "馬告（山胡椒）");
    await goToCartAndCheckout(page);

    await page.getByRole("button", { name: /繼續結帳/ }).click();
    await expect(page).toHaveURL(/\/evidence/);
  });
});

test.describe("食譜 Popup — educate 模式（三種對應商品都沒有）", () => {
  test("只有零食 → 顯示三食譜教育彈窗", async ({ page }) => {
    await enterAsGuest(page);
    await page.getByRole("button", { name: "零食" }).click();
    await addProductByName(page, "多力多滋（芝士）");
    await goToCartAndCheckout(page);

    await expect(
      page.getByRole("heading", { name: "你想不想了解泰雅族特色飲食呢？" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /馬告咖啡/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /馬告冬瓜茶/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /馬告炒泡麵/ })).toBeVisible();
  });

  test("點擊食譜卡片 → 開啟食譜圖片 lightbox", async ({ page }) => {
    await enterAsGuest(page);
    await page.getByRole("button", { name: "零食" }).click();
    await addProductByName(page, "多力多滋（芝士）");
    await goToCartAndCheckout(page);

    await page.getByRole("button", { name: /馬告咖啡/ }).click();
    await expect(page.getByAltText("馬告咖啡 食譜")).toBeVisible();
    await page.getByRole("button", { name: "關閉食譜" }).click();
    await expect(page.getByAltText("馬告咖啡 食譜")).toBeHidden();
  });

  test("按忍痛放棄 → 進入拍照存證頁", async ({ page }) => {
    await enterAsGuest(page);
    await page.getByRole("button", { name: "零食" }).click();
    await addProductByName(page, "多力多滋（芝士）");
    await goToCartAndCheckout(page);

    await page.getByRole("button", { name: "忍痛放棄" }).click();
    await expect(page).toHaveURL(/\/evidence/);
  });

  test("一鍵新增 → 馬告＋咖啡粉 → 回購物車確認 → 結帳跳付款頁", async ({ page }) => {
    await enterAsGuest(page);
    await page.getByRole("button", { name: "零食" }).click();
    await addProductByName(page, "多力多滋（芝士）");
    await goToCartAndCheckout(page);

    await page.getByRole("button", { name: /一鍵新增/ }).click();
    await page.getByRole("button", { name: "馬告 ＋ 咖啡粉" }).click();

    // 回購物車確認
    await expect(page.getByText("購物車清單")).toBeVisible();
    // 多力多滋 49 + 馬告 80 + 咖啡粉 45 = 174
    await expect(page.getByText(/174/).first()).toBeVisible();

    // 再次結帳 → celebrate popup → 繼續結帳
    await page.getByTestId("btn-checkout").click();
    await page.getByRole("button", { name: /繼續結帳/ }).click();
    await expect(page).toHaveURL(/\/evidence/);
  });

  test("一鍵新增 → 馬告＋泡麵 → 顯示子選單 → 選統一牛肉麵 → 回購物車", async ({ page }) => {
    await enterAsGuest(page);
    await page.getByRole("button", { name: "零食" }).click();
    await addProductByName(page, "多力多滋（芝士）");
    await goToCartAndCheckout(page);

    await page.getByRole("button", { name: /一鍵新增/ }).click();
    await page.getByRole("button", { name: "馬告 ＋ 泡麵 ▸" }).click();

    // 子選單出現三種泡麵
    await expect(page.getByRole("button", { name: /統一牛肉麵/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /統一米粉/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /維力炸醬麵/ })).toBeVisible();

    await page.getByRole("button", { name: /統一牛肉麵/ }).click();

    // 回購物車確認
    await expect(page.getByText("購物車清單")).toBeVisible();
    // 多力多滋 49 + 馬告 80 + 牛肉麵 32 = 161
    await expect(page.getByText(/161/).first()).toBeVisible();

    // 再次結帳 → celebrate popup → 繼續結帳
    await page.getByTestId("btn-checkout").click();
    await page.getByRole("button", { name: /繼續結帳/ }).click();
    await expect(page).toHaveURL(/\/evidence/);
  });
});

test.describe("食譜 Popup — 族人流程不觸發", () => {
  test("族人結帳不跳 popup，直接到 /evidence", async ({ page }) => {
    await enterAsTribalToScan(page);

    // 透過 scan 流程加一個隨機商品入購物車
    await page.getByTestId("btn-scan").click();
    await expect(page.getByText("辨識結果")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("btn-confirm-item").click();
    await page.getByTestId("btn-view-cart").click();
    await expect(page.getByText("購物車清單")).toBeVisible();

    await page.getByTestId("btn-checkout").click();

    // 族人流程直接到拍照存證頁，不應跳食譜 popup
    await expect(
      page.getByRole("heading", { name: "拍照存證" })
    ).toBeVisible();
    await expect(page.getByText("Tayal Recipe")).toBeHidden();
  });
});

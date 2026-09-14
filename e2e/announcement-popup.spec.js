// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * 部落誠實商店 — 公告 Popup / 跑馬燈 E2E 測試
 *
 * 族人流程入口（WelcomePage 點族人 → AuthPage）會自動彈出公告。
 * 使用 ?e2e=true 繞過相機/錄音權限。
 */

const BASE = "http://localhost:5173/?e2e=true";

async function goToAuth(page) {
  await page.goto(BASE);
  await page.getByTestId("btn-tribal").click();
  await expect(page.getByText("賒帳身份驗證")).toBeVisible();
}

test.describe("公告 Popup（族人驗證頁）", () => {
  test("進入 AuthPage 自動彈出公告", async ({ page }) => {
    await goToAuth(page);
    await expect(page.getByText("最新消息")).toBeVisible();
    await expect(page.getByText("部落豐年祭特別活動開跑！")).toBeVisible();
    await expect(page.getByText("15 秒後將自動關閉")).toBeVisible();
  });

  test("查看詳情按鈕有正確的外部連結", async ({ page }) => {
    await goToAuth(page);
    const link = page.getByRole("link", { name: /查看詳情/ });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute(
      "href",
      "https://www.tribal-shop.example/news/harvest-festival"
    );
  });

  test("點 × 關閉 popup，跑馬燈出現在 Header", async ({ page }) => {
    await goToAuth(page);
    await page.getByRole("button", { name: "關閉" }).click();

    await expect(
      page.getByRole("heading", { name: "部落豐年祭特別活動開跑！" })
    ).toBeHidden();

    const marquee = page.getByRole("button", { name: "查看最新消息" });
    await expect(marquee).toBeVisible();
  });

  test("點擊跑馬燈重新開啟 popup", async ({ page }) => {
    await goToAuth(page);
    await page.getByRole("button", { name: "關閉" }).click();
    await page.getByRole("button", { name: "查看最新消息" }).click();
    await expect(page.getByText("最新消息")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "部落豐年祭特別活動開跑！" })
    ).toBeVisible();
  });

  test("點背景遮罩關閉 popup", async ({ page }) => {
    await goToAuth(page);
    // 點視窗邊緣（避開白色卡片內部）
    await page.mouse.click(10, 10);
    await expect(
      page.getByRole("heading", { name: "部落豐年祭特別活動開跑！" })
    ).toBeHidden();
  });
});

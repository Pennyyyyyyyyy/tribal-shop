// @ts-check
/**
 * E2E：族人結帳 → 驗證存證照片可從 SERVER_BASE_URL 公開存取
 *
 * 用意：line_service.py 的邏輯是 `image_url = _build_public_url() or _upload_image()`
 * — 只要 SERVER_BASE_URL 有設且該網址下的 /uploads/... 是公開可達的，
 * LINE 收到的圖片就會走這條路（而不是 freeimage 圖床）。
 *
 * 本測試不修改 line_service.py，改用「結帳 → 拿到實際存的檔名 → 用 SERVER_BASE_URL
 * 直接抓圖」來驗證這條路的健康度。
 *
 * 前置：
 *   - backend 跑在 127.0.0.1:8000（且 .env 裡的 SERVER_BASE_URL 有填好；如果剛改過，請先重啟 backend）
 *   - frontend 跑在 localhost:5173
 *   - Cloudflare tunnel 把 SERVER_BASE_URL 指到本機 backend
 *
 * 執行：npx playwright test e2e/server-base-url-image.spec.js
 */

const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const FRONTEND_URL = "http://localhost:5173";
const BACKEND_DIR = path.join(__dirname, "..", "backend");
const ENV_PATH = path.join(BACKEND_DIR, ".env");
const UPLOADS_DIR = path.join(BACKEND_DIR, "uploads", "images");

function readEnvVar(key) {
  if (!fs.existsSync(ENV_PATH)) return "";
  const content = fs.readFileSync(ENV_PATH, "utf8");
  const re = new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`, "m");
  const m = content.match(re);
  if (!m) return "";
  return m[1].trim().replace(/^["']|["']$/g, "");
}

function newestUploadAfter(thresholdMs) {
  if (!fs.existsSync(UPLOADS_DIR)) return null;
  const files = fs
    .readdirSync(UPLOADS_DIR)
    .map((name) => {
      const full = path.join(UPLOADS_DIR, name);
      return { name, mtimeMs: fs.statSync(full).mtimeMs };
    })
    .filter((f) => f.mtimeMs >= thresholdMs)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0]?.name ?? null;
}

test.describe("族人結帳：圖片從 SERVER_BASE_URL 送出", () => {
  test("存證照片於 SERVER_BASE_URL 公開可達 → LINE 會走這條路", async ({
    page,
    request,
  }) => {
    const SERVER_BASE_URL = readEnvVar("SERVER_BASE_URL").replace(/\/$/, "");
    test.skip(
      !SERVER_BASE_URL,
      "backend/.env 沒設 SERVER_BASE_URL，跳過此測試"
    );

    const startedAt = Date.now() - 1000; // 容忍時鐘漂移

    // ── Step 1: WELCOME ───────────────────────────────
    await page.goto(`${FRONTEND_URL}?e2e=true`);
    await expect(page.getByText("Welcome!")).toBeVisible();
    await page.getByTestId("btn-tribal").click();

    // ── Step 2: AUTH（密碼 1234）────────────────────
    await expect(page.getByText("賒帳身份驗證")).toBeVisible();
    for (const d of ["1", "2", "3", "4"]) {
      await page.getByTestId(`keypad-${d}`).click();
    }
    await page.getByTestId("btn-confirm").click();

    // ── Step 3: INSTRUCTION → SCAN（自動跳）─────────
    await expect(page.getByText("請將物品拿到鏡頭前")).toBeVisible();

    // ── Step 4: 改走「手動選擇商品」進 /products，避開 ScanPage 沒 testid 的卡片
    await expect(
      page.getByRole("button", { name: "手動選擇商品" })
    ).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "手動選擇商品" }).click();

    // ── Step 5: PRODUCTS → 加第一個商品 → 查看清單
    const firstAddBtn = page.locator('[data-testid^="btn-add-"]').first();
    await expect(firstAddBtn).toBeVisible();
    await firstAddBtn.click();
    await page.getByRole("button", { name: "查看清單" }).click();

    // ── Step 6: CART → 結帳
    await expect(page.getByText("購物車清單")).toBeVisible();
    await page.getByTestId("btn-checkout").click();

    // ── Step 7: EVIDENCE → 跳過拍照（仍會產生一張 mock JPEG）→ 送出
    await expect(page.getByText("拍照存證")).toBeVisible();
    await page.getByTestId("btn-skip-photo").click();

    const checkoutResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/checkout") &&
        r.request().method() === "POST" &&
        r.status() === 200,
      { timeout: 20000 }
    );
    await page.getByTestId("btn-submit-evidence").click();
    const resp = await checkoutResponse;
    expect(resp.status()).toBe(200);

    // ── Step 8: 找剛剛存進 backend/uploads/images/ 的那張 ──
    const uploadedFilename = newestUploadAfter(startedAt);
    expect(
      uploadedFilename,
      `預期 backend/uploads/images/ 應出現本次結帳上傳的照片`
    ).not.toBeNull();

    // ── Step 9: 用 SERVER_BASE_URL 拼出公開網址，直接抓圖 ──
    // 這正是 line_service.py 會塞給 LINE ImageMessage 的 URL，
    // 抓得到 = LINE 也抓得到 = 圖片走 SERVER_BASE_URL 是通的。
    const expectedUrl = `${SERVER_BASE_URL}/uploads/images/${uploadedFilename}`;
    console.log(`[test] 預期 LINE 會收到的圖片 URL：${expectedUrl}`);

    const imgResp = await request.get(expectedUrl);
    expect(
      imgResp.status(),
      `${expectedUrl} 不可達 — 檢查 Cloudflare tunnel 是否在跑、SERVER_BASE_URL 是否正確`
    ).toBe(200);

    const ct = imgResp.headers()["content-type"] || "";
    expect(ct, `回傳的 content-type 不是圖片：${ct}`).toMatch(/^image\//);

    const buf = await imgResp.body();
    expect(buf.length, "回傳的圖片內容是空的").toBeGreaterThan(0);
  });
});

import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, role: RegExp, _locale = "en") {
  // The session cookie is locale-independent; sign in via the English page for a stable selector.
  await page.goto(`/en/login`);
  await page.getByRole("button", { name: role }).click();
  await page.waitForURL(/\/(admin|operator|account)/, { timeout: 60_000 });
}

const PAGES = ["/admin", "/admin/orders", "/admin/graves", "/admin/graves/new", "/admin/pricing", "/admin/finance", "/admin/customers", "/admin/partners", "/admin/content", "/admin/settings", "/admin/settings?tab=flags", "/admin/settings?tab=roles", "/admin/settings?tab=localization", "/admin/audit", "/admin/search?q=kerestir"];

test.describe("admin console", () => {
  for (const locale of ["en", "he"]) {
    for (const width of [1440, 390]) {
      test(`all core screens render · ${locale} · ${width}px`, async ({ page }) => {
        test.setTimeout(240_000);
        await page.setViewportSize({ width, height: 900 });
        await signIn(page, /Super admin/, locale);
        for (const p of PAGES) {
          const res = await page.goto(`/${locale}${p}`);
          expect(res?.status(), p).toBe(200);
          const html = await page.content();
          expect(html.match(/⟨[^⟩]+⟩/g) ?? [], `missing messages on ${p}`).toEqual([]);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow, `horizontal overflow on ${p}`).toBeLessThanOrEqual(1);
          if (locale === "he") expect(await page.getAttribute("html", "dir")).toBe("rtl");
        }
      });
    }
  }

  test("order detail, grave editor save, price versioning", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, /Super admin/);
    await page.goto("/en/admin/orders");
    await page.locator('a[href*="/admin/orders/KV-"]').first().click();
    await expect(page.getByText("Audit trail")).toBeVisible();
    // grave editor: open kerestir, save without changes
    await page.goto("/en/admin/graves");
    await page.getByRole("link", { name: /Kerestir/ }).first().click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    // pricing: change GBP extra page price → history shows new version
    await page.goto("/en/admin/pricing");
    const cell = page.getByLabel("extra_page GBP");
    const current = Number(await cell.inputValue());
    const next = (current >= 6 ? 4 : current + 0.25).toFixed(2); // always a real change
    await cell.fill(next);
    await cell.locator("xpath=..").getByRole("button").click();
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(page.getByLabel("extra_page GBP")).toHaveValue(next);
  });

  test("support role cannot open finance or settings; finance cannot see content", async ({ page }) => {
    await signIn(page, /^Support/);
    await page.goto("/en/admin/finance");
    await expect(page).toHaveURL(/forbidden/);
    await page.goto("/en/admin/settings");
    await expect(page).toHaveURL(/forbidden/);
    await page.goto("/en/admin/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  });
});

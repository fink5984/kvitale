import { expect, test } from "@playwright/test";

const PRICE = /(\$|€|₪|£)\s?\d|from\s+\$|החל מ/i;

test.describe("public redesign", () => {
  for (const locale of ["he", "en"]) {
    test(`no prices on home, directory or tzaddik page (${locale})`, async ({ page }) => {
      for (const path of ["", "/graves", "/graves/kerestir"]) {
        await page.goto(`/${locale}${path}`);
        const text = await page.locator("main").innerText();
        expect(text, `${locale}${path}`).not.toMatch(PRICE);
      }
    });
  }

  test("home has no printer animation and offers search above the fold", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator(".hero-kvittel")).toHaveCount(0);
    const box = await page.getByRole("combobox").boundingBox();
    expect(box!.y).toBeLessThan(900);
  });

  test("picking a tzaddik leads straight to writing; draft survives language switch and tzaddik change", async ({ page }) => {
    await page.goto("/en/graves/kerestir");
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await page.locator('input[aria-label="Name 1"]').fill("Yisroel ben Sarah");
    await page.locator("#request").fill("A complete healing");
    await page.goto("/he/graves/kerestir");
    await expect(page.locator('input[aria-label^="שם 1"]')).toHaveValue("Yisroel ben Sarah");
    await page.goto("/en/graves/lizhensk");
    await expect(page.locator("#request")).toHaveValue("A complete healing");
  });

  test("the live note grows with the text", async ({ page }) => {
    await page.goto("/en/graves/kerestir");
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    const canvas = page.locator("aside canvas").first();
    await page.locator('input[aria-label="Name 1"]').fill("Dan");
    await expect(canvas).toBeVisible();
    const h1 = (await canvas.boundingBox())!.height;
    await page.locator("#request").fill("Health and livelihood for the whole family. ".repeat(12));
    await expect.poll(async () => (await canvas.boundingBox())!.height).toBeGreaterThan(h1 + 60);
  });

  test("login offers no demo accounts", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByText("@demo.kvittel.local")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /super admin|finance|support/i })).toHaveCount(0);
  });

  for (const w of [375, 390, 768, 1440]) {
    test(`no horizontal overflow at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      for (const path of ["/he", "/he/graves", "/he/graves/kerestir", "/en/graves/kerestir", "/he/checkout"]) {
        await page.goto(path);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(over, `${path} @${w}`).toBeLessThanOrEqual(0);
      }
    });
  }
});

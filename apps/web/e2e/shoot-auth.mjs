// node e2e/shoot-auth.mjs <outDir> <width> <path...>  (signed in as DEMO super admin)
import { chromium } from "@playwright/test";
const [out, width, ...paths] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome" });
const page = await b.newPage({ viewport: { width: Number(width), height: 900 } });
await page.goto("http://localhost:3000/en/login");
await page.getByRole("button", { name: /Super admin/ }).click();
await page.waitForURL(/admin/, { timeout: 120000 });
for (const p of paths) {
  await page.goto(`http://localhost:3000${p}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${p.replace(/[^a-z0-9]+/gi, "_")}_${width}.png`, fullPage: true });
}
await b.close();

// Ad-hoc screenshot helper: node e2e/shoot.mjs <outDir> <width> <path> [<path>...]
import { chromium } from "@playwright/test";
const [out, width, ...paths] = process.argv.slice(2);
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" });
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(width) < 600 ? 844 : 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
for (const p of paths) {
  await page.goto(`http://localhost:3000${p}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const name = `${p.replace(/[^a-z0-9]+/gi, "_")}_${width}.png`;
  await page.screenshot({ path: `${out}/${name}`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(name, "overflowX:", overflow);
}
console.log("errors:", errors.slice(0, 8));
await browser.close();

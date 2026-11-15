// node e2e/shoot-el.mjs <out.png> <width> <path> <selector>
import { chromium } from "@playwright/test";
const [out, width, p, sel] = process.argv.slice(2);
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" });
const page = await browser.newPage({ viewport: { width: Number(width), height: 844 } });
await page.goto(`http://localhost:3000${p}`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const el = page.locator(sel).first();
await el.screenshot({ path: out });
const info = await el.evaluate((n) => ({ w: n.scrollWidth, cw: n.clientWidth }));
console.log(info);
await browser.close();

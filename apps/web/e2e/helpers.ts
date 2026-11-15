import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { SimulatedDevice } from "../../../packages/device-sim/src/index";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export function simFor(grave: string) {
  const all = JSON.parse(readFileSync(path.resolve(process.cwd(), "../../.data/sim-devices.json"), "utf8")) as Array<{ deviceId: string; token: string; grave: string }>;
  const d = all.find((x) => x.grave === grave)!;
  const sim = new SimulatedDevice({ server: BASE, token: d.token, deviceId: d.deviceId });
  sim.knobs.printDelayMs = 50;
  sim.knobs.chuteDelayMs = 50;
  return sim;
}

/** Guest journey up to the order page. Returns the order ref. */
export async function orderKvittel(page: Page, opts: { locale?: string; grave: string; given: string; parent: string; request: string; email: string }) {
  const l = opts.locale ?? "en";
  await page.goto(`/${l}/write?grave=${opts.grave}`);
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`/${l}/write?grave=${opts.grave}`);
  await page.locator('input[id^="g-"]').first().fill(opts.given);
  await page.locator('input[id^="p-"]').first().fill(opts.parent);
  await page.locator("#request").fill(opts.request);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(`**/${l}/cart`);
  await page.locator('a[href$="/checkout"]').click();
  await page.waitForURL(`**/${l}/checkout`);
  await page.locator("#email").fill(opts.email);
  await page.locator('input[type=checkbox]').first().check();
  const consent = page.getByText(/printed later/i);
  if (await consent.count()) await consent.click();
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(/\/pay\/demo\//);
  await page.getByRole("button", { name: /successful payment/i }).click();
  await page.waitForURL(/\/order\/KV-/);
  const ref = page.url().match(/order\/(KV-[A-Z0-9]+)/)![1]!;
  await expect(page.getByText(/on its way/i)).toBeVisible();
  return ref;
}

import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const sims = JSON.parse(readFileSync(path.resolve(process.cwd(), "../../.data/sim-devices.json"), "utf8")) as Array<{ deviceId: string; grave: string }>;
const lizhensk = sims.find((s) => s.grave === "lizhensk")!.deviceId;
const kerestir = sims.find((s) => s.grave === "kerestir")!.deviceId;

async function demoLogin(page: Page, role: RegExp) {
  await page.goto("/en/login");
  await page.getByRole("button", { name: role }).click();
}

async function noMissingKeys(page: Page) {
  const html = await page.content();
  expect(html.match(/⟨[^⟩]+⟩/g) ?? []).toEqual([]);
}

async function noOverflow(page: Page) {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, `overflow at ${width}`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test.describe("operator portal (scoped)", () => {
  test("local maintainer sees only Kerestir, cannot reach admin or other units", async ({ page }) => {
    await demoLogin(page, /Local maintainer/);
    await page.waitForURL("**/en/operator");
    await expect(page.getByRole("heading", { name: "Your units" })).toBeVisible();
    await expect(page.getByText("Rabbi Yeshaya of Kerestir")).toBeVisible();
    await expect(page.getByText(/Elimelech|Lizhensk|Leżajsk/)).toHaveCount(0);
    await noMissingKeys(page);
    await noOverflow(page);

    await page.goto("/en/admin");
    await expect(page).not.toHaveURL(/\/admin/);

    const res = await page.goto(`/en/operator/roll/${lizhensk}`);
    expect(res?.status()).toBe(404);

    await page.goto("/he/operator");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "העמדות שלכם" })).toBeVisible();
    await noMissingKeys(page);
  });

  test("paper roll change workflow + tickets", async ({ page }) => {
    await demoLogin(page, /Local maintainer/);
    await page.waitForURL("**/en/operator");
    await page.goto(`/en/operator/roll/${kerestir}`);
    for (const cb of await page.locator('input[type="checkbox"]').all()) await cb.check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/Estimated length/)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Confirm roll change" }).click();
    await expect(page.getByText("Roll change recorded")).toBeVisible();
    await noMissingKeys(page);

    await page.goto("/en/operator/tickets");
    await page.getByRole("button", { name: "New ticket" }).first().click();
    await page.locator("#tk-title").fill("E2E: chute guide slightly loose");
    await page.getByRole("button", { name: "Create ticket" }).click();
    await expect(page.getByText("E2E: chute guide slightly loose").first()).toBeVisible();
    await noMissingKeys(page);
    await noOverflow(page);
  });
});

test.describe("device lab (DEMO)", () => {
  test("super admin drives the Kerestir unit and injects a fault", async ({ page }) => {
    await demoLogin(page, /Super admin/);
    await page.waitForURL("**/en/admin**");
    await page.goto("/en/admin/lab");
    await expect(page.getByRole("heading", { name: "Device lab" })).toBeVisible();
    const unit = page.getByTestId("lab-unit");
    await unit.selectOption({ value: kerestir });
    await page.getByTestId("lab-tick").click();
    // first heartbeat may wait for the dev server to compile the device API route
    await expect(page.getByTestId("lab-heartbeat")).toHaveText("Accepted", { timeout: 60_000 });
    await page.getByTestId("knob-online").click();
    await expect(page.getByTestId("knob-online")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("lab-tick").click();
    await expect(page.getByTestId("lab-heartbeat")).toHaveText("Failed");
    await expect(page.getByTestId("lab-phase")).toHaveText("Offline");
    await page.getByTestId("knob-online").click();
    await page.getByTestId("lab-tick").click();
    await expect(page.getByTestId("lab-heartbeat")).toHaveText("Accepted");
    await expect(page.getByTestId("lab-log").locator("li")).not.toHaveCount(0);
    await noMissingKeys(page);
    await noOverflow(page);

    await page.goto("/he/admin/lab");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "מעבדת התקנים" })).toBeVisible();
  });

  test("sim-devices endpoint is not available to anonymous users", async ({ request }) => {
    const r = await request.get("/api/dev/sim-devices");
    expect(r.status()).toBe(404);
  });
});

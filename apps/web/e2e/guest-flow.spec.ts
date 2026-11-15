import { expect, test } from "@playwright/test";
import { orderKvittel, simFor } from "./helpers";

test.describe("guest kvittel → print → delivery", () => {
  test("happy path: sensor-confirmed delivery, no account", async ({ page }) => {
    const sim = simFor("kerestir");
    await sim.tick(); // device online
    const ref = await orderKvittel(page, { grave: "kerestir", given: "Yosef Chaim", parent: "Sarah", request: "E2E happy path — שלום", email: "e2e-happy@example.com" });
    await expect(page.getByText("In the queue").first()).toBeVisible();
    await sim.tick();
    expect(sim.printed.length).toBeGreaterThan(0);
    await page.reload();
    await expect(page.getByText("Delivered").first()).toBeVisible();
    await expect(page.getByText(/Confirmed by the optical sensor/)).toBeVisible();
    // privacy: the tracking page never shows the content
    await expect(page.getByText("E2E happy path")).toHaveCount(0);
    // confirmation email captured by the dev mailbox
    await page.goto("/en/dev/mailbox");
    await expect(page.locator('[data-testid="mail-to"]', { hasText: "e2e-happy@example.com" }).first()).toBeVisible();
    expect(ref).toMatch(/^KV-/);
  });

  test("chute sensor timeout → uncertain, never reprinted", async ({ page }) => {
    const sim = simFor("kerestir");
    await sim.tick();
    await orderKvittel(page, { grave: "kerestir", given: "Rachel", parent: "Leah", request: "E2E uncertain", email: "e2e-uncertain@example.com" });
    sim.knobs.chuteSensorFail = true;
    for (let i = 0; i < 3; i++) {
      await sim.tick();
      await page.reload();
      if (await page.getByText("Under review").first().isVisible()) break;
    }
    sim.knobs.chuteSensorFail = false;
    const printedOnce = sim.printed.length;
    await expect(page.getByText("Under review").first()).toBeVisible();
    await sim.tick(); // must NOT print it again
    expect(sim.printed.length).toBe(printedOnce);
  });

  test("printer disconnected → stays queued, then prints on reconnect", async ({ page }) => {
    const sim = simFor("lizhensk");
    await sim.tick();
    await orderKvittel(page, { grave: "lizhensk", given: "David", parent: "Miriam", request: "E2E offline", email: "e2e-offline@example.com" });
    sim.knobs.online = false;
    await sim.tick();
    await page.reload();
    await expect(page.getByText("In the queue").first()).toBeVisible();
    sim.knobs.online = true;
    await sim.tick();
    await page.reload();
    await expect(page.getByText("Delivered").first()).toBeVisible();
  });
});

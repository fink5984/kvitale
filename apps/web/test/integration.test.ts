/**
 * Integration tests against a real (embedded) PostgreSQL in a temp directory:
 * webhook replay & spoofing, idempotent device events, no double printing,
 * lease expiry semantics, device auth.
 */
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { deviceAssignments, deviceCredentials, devices, graves, graveSchedules, kvittels, orderItems, orders, paperRolls, payments, printAttempts, printJobs, seal, sha256 } from "@kvittel/db";
import { getDb } from "@/server/db";
import { authenticateDevice, type DeviceRow } from "@/server/devices";
import { processPaymentEvent } from "@/server/orders";
import { handleJobEvent, leaseJob, sweepExpiredLeases } from "@/server/queue";

const TOKEN = `kvd_${"t".repeat(32)}`;
let device: DeviceRow;
let graveId: string;

async function makeOrder(ref: string, amount = 1800) {
  const db = await getDb();
  const [o] = await db.insert(orders).values({ publicRef: ref, email: "it@example.com", locale: "en", currency: "USD", subtotalMinor: amount, totalMinor: amount, priceSnapshot: {} }).returning();
  const content = { template: "classic", nusach: "en", graveDisplayName: "Rabbi Test", people: [{ id: "1", mode: "structured", given: "Yosef", parent: "Sarah", relation: "ben" }], topics: [], request: "integration", showBH: true };
  const [k] = await db.insert(kvittels).values({ contentEnc: seal(JSON.stringify(content)), contentDigest: "x", template: "classic", nusach: "en", pageCount: 1, lengthMm: 90, layoutVersion: "1.0.0" }).returning();
  await db.insert(orderItems).values({ orderId: o!.id, graveId, kvittelId: k!.id, unitPriceMinor: amount, totalMinor: amount });
  await db.insert(payments).values({ orderId: o!.id, provider: "mock", providerRef: `ref_${ref}`, amountMinor: amount, currency: "USD", isDemo: true });
  return o!;
}

const ev = (ref: string, id: string, amount = 1800) => ({ eventId: id, type: "payment.succeeded" as const, providerRef: `ref_${ref}`, amountMinor: amount, currency: "USD" });

beforeAll(async () => {
  const db = await getDb(); // migrates the fresh temp database
  const [g] = await db.insert(graves).values({ slug: "it-grave", status: "active", timezone: "UTC", observeShabbat: false, observeYomTov: false, permitStatus: "approved", publishedAt: new Date() }).returning();
  graveId = g!.id;
  await db.insert(graveSchedules).values([0, 1, 2, 3, 4, 5, 6].map((wd) => ({ graveId, weekday: wd, openMinute: 0, closeMinute: 1440 })));
  const [d] = await db.insert(devices).values({ serial: "IT-1", name: "IT unit", status: "active", lastSeenAt: new Date(), isSimulated: true }).returning();
  device = d!;
  await db.insert(deviceCredentials).values({ deviceId: device.id, tokenHash: sha256(TOKEN), tokenPrefix: TOKEN.slice(0, 10) });
  await db.insert(deviceAssignments).values({ deviceId: device.id, graveId });
  await db.insert(paperRolls).values({ deviceId: device.id, outerDiameterMm: 40, coreDiameterMm: 12, thicknessMm: 0.06 });
});

describe("payments", () => {
  it("marks paid once and ignores replays of the same event", async () => {
    const o = await makeOrder("KV-IT0001");
    expect((await processPaymentEvent("mock", ev("KV-IT0001", "evt_a"), "d")).outcome).toBe("paid");
    expect((await processPaymentEvent("mock", ev("KV-IT0001", "evt_a"), "d")).outcome).toBe("duplicate_ignored");
    expect((await processPaymentEvent("mock", ev("KV-IT0001", "evt_b"), "d")).outcome).toBe("already_processed");
    const db = await getDb();
    const jobs = await db.select().from(printJobs).innerJoin(orderItems, eq(orderItems.id, printJobs.orderItemId)).where(eq(orderItems.orderId, o.id));
    expect(jobs).toHaveLength(1); // exactly one print job — no double charge / double print
  });

  it("refuses to mark paid when the amount does not match (spoofed / partial capture)", async () => {
    const o = await makeOrder("KV-IT0002", 1800);
    expect((await processPaymentEvent("mock", ev("KV-IT0002", "evt_c", 100), "d")).outcome).toBe("amount_mismatch");
    const db = await getDb();
    const [row] = await db.select().from(orders).where(eq(orders.id, o.id));
    expect(row!.status).toBe("pending_payment");
  });
});

describe("device protocol & queue", () => {
  it("rejects invalid and malformed device tokens", async () => {
    expect(await authenticateDevice(new Request("http://x", { headers: { authorization: `Bearer kvd_${"x".repeat(32)}` } }))).toBeNull();
    expect(await authenticateDevice(new Request("http://x", { headers: { authorization: "Bearer ' OR 1=1 --" } }))).toBeNull();
    expect((await authenticateDevice(new Request("http://x", { headers: { authorization: `Bearer ${TOKEN}` } })))?.id).toBe(device.id);
  });

  it("happy path to delivered; duplicate events are idempotent; no second lease", async () => {
    await makeOrder("KV-IT0003");
    await processPaymentEvent("mock", ev("KV-IT0003", "evt_d"), "d");
    // drain any earlier job first
    let job = await leaseJob(device);
    while (job && job.raster.pages.length === 0) job = await leaseJob(device);
    expect(job).not.toBeNull();
    expect(job!.raster.widthDots).toBe(384);
    expect(job!.raster.pages[0]!.data.length).toBeGreaterThan(100);
    const send = (type: Parameters<typeof handleJobEvent>[2]["type"], uid: string) => handleJobEvent(device, job!.jobId, { leaseId: job!.leaseId, eventUid: uid, type });
    expect((await send("print_started", "u1")) as { status: string }).toMatchObject({ status: "printing" });
    expect((await send("print_started", "u1")) as { status: string }).toMatchObject({ status: "printing" }); // duplicate
    await send("print_completed", "u2");
    await send("cut_completed", "u3");
    expect((await send("chute_detected", "u4")) as { status: string }).toMatchObject({ status: "delivered" });
    const db = await getDb();
    const [j] = await db.select().from(printJobs).where(eq(printJobs.id, job!.jobId));
    expect(j!.status).toBe("delivered");
    expect(j!.confidence).toBe("sensor_confirmed");
    const [roll] = await db.select().from(paperRolls).where(eq(paperRolls.deviceId, device.id));
    expect(roll!.usedMm).toBeGreaterThan(0); // paper accounting counted once
  });

  it("lease expired BEFORE printing → safely re-queued; AFTER print_started → uncertain, never reprinted", async () => {
    const db = await getDb();
    await makeOrder("KV-IT0004");
    await processPaymentEvent("mock", ev("KV-IT0004", "evt_e"), "d");
    const a = (await leaseJob(device))!;
    await db.update(printJobs).set({ leaseExpiresAt: new Date(Date.now() - 1000) }).where(eq(printJobs.id, a.jobId));
    await sweepExpiredLeases();
    let [j] = await db.select().from(printJobs).where(eq(printJobs.id, a.jobId));
    expect(j!.status).toBe("queued");

    const b = (await leaseJob(device))!;
    expect(b.jobId).toBe(a.jobId);
    expect(b.attemptNo).toBe(2);
    await handleJobEvent(device, b.jobId, { leaseId: b.leaseId, eventUid: "x1", type: "print_started" });
    await db.update(printJobs).set({ leaseExpiresAt: new Date(Date.now() - 10 * 60_000) }).where(eq(printJobs.id, b.jobId));
    await sweepExpiredLeases();
    [j] = await db.select().from(printJobs).where(eq(printJobs.id, b.jobId));
    expect(j!.status).toBe("uncertain");
    const again = await leaseJob(device);
    expect(again?.jobId).not.toBe(b.jobId); // the uncertain job is never handed out again automatically
    const attempts = await db.select().from(printAttempts).where(eq(printAttempts.jobId, b.jobId));
    expect(attempts.map((x) => x.outcome).sort()).toEqual(["expired", "uncertain"]);
  });

  it("an event for a stale lease tells the device to stop", async () => {
    await makeOrder("KV-IT0005");
    await processPaymentEvent("mock", ev("KV-IT0005", "evt_f"), "d");
    const job = (await leaseJob(device))!;
    const r = await handleJobEvent(device, job.jobId, { leaseId: "lease_forged", eventUid: "s1", type: "print_completed" });
    expect(r).toMatchObject({ next: "stop" });
  });
});

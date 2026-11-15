import { describe, expect, it } from "vitest";
import { log } from "@/server/log";
import { mockProvider, mockSign } from "@/server/payments/mock";
import { permissionsFor } from "@/server/rbac";
import { closedReason, nextHilula, type GraveServicePolicy } from "@/server/schedule";
import { latinSkeleton } from "@/server/graves";
import { checkoutSchema, kvittelContentSchema } from "@/lib/kvittel-schema";

const policy: GraveServicePolicy = {
  timezone: "Europe/Budapest",
  observeShabbat: true,
  observeYomTov: true,
  israelHolidays: false,
  shabbatCutoffMinute: 720,
  schedules: [0, 1, 2, 3, 4, 5].map((wd) => ({ weekday: wd, openMinute: 420, closeMinute: wd === 5 ? 720 : 1260 })),
};

describe("payment webhook signatures", () => {
  const body = JSON.stringify({ id: "evt_1", type: "payment.succeeded", data: { providerRef: "mock_cs_x", amountMinor: 1800, currency: "USD" } });
  it("accepts a valid signature", async () => {
    const ev = await mockProvider.verifyWebhook(body, new Headers({ "x-kvittel-mock-signature": mockSign(body) }));
    expect(ev?.eventId).toBe("evt_1");
  });
  it("rejects a tampered body (e.g. amount changed by an attacker)", async () => {
    const sig = mockSign(body);
    const tampered = body.replace("1800", "1");
    expect(await mockProvider.verifyWebhook(tampered, new Headers({ "x-kvittel-mock-signature": sig }))).toBeNull();
  });
  it("rejects replays outside the 5-minute tolerance", async () => {
    const old = mockSign(body, Math.floor(Date.now() / 1000) - 3600);
    expect(await mockProvider.verifyWebhook(body, new Headers({ "x-kvittel-mock-signature": old }))).toBeNull();
  });
  it("rejects a missing signature", async () => {
    expect(await mockProvider.verifyWebhook(body, new Headers())).toBeNull();
  });
});

describe("RBAC — least privilege", () => {
  it("support can request but not approve refunds, and never read content", () => {
    const p = permissionsFor(["support_limited"]);
    expect(p.has("orders.refund.request")).toBe(true);
    expect(p.has("orders.refund.approve")).toBe(false);
    expect(p.has("kvittel.content.read")).toBe(false);
    expect(p.has("finance.read")).toBe(false);
  });
  it("admin cannot read content or change roles; super_admin can (audited)", () => {
    expect(permissionsFor(["admin"]).has("kvittel.content.read")).toBe(false);
    expect(permissionsFor(["admin"]).has("roles.write")).toBe(false);
    expect(permissionsFor(["super_admin"]).has("kvittel.content.read")).toBe(true);
  });
  it("partner roles have no admin access", () => {
    for (const r of ["partner_manager", "local_maintainer"] as const) {
      expect(permissionsFor([r]).has("admin.access")).toBe(false);
      expect(permissionsFor([r]).has("orders.read")).toBe(false);
    }
  });
  it("customers have no back-office permission at all", () => {
    expect(permissionsFor(["customer"]).size).toBe(0);
  });
});

describe("sensitive logging", () => {
  it("redacts kvittel content, names, tokens and emails at any depth", () => {
    const out = log.redact({ jobId: "j1", content: { request: "secret" }, nested: { people: ["Yosef"], token: "kvd_x", email: "a@b.c", ok: 1 } }) as Record<string, unknown>;
    const s = JSON.stringify(out);
    expect(s).not.toContain("secret");
    expect(s).not.toContain("Yosef");
    expect(s).not.toContain("kvd_x");
    expect(s).not.toContain("a@b.c");
    expect(s).toContain("j1");
  });
});

describe("service windows (Shabbat / Yom Tov / hours)", () => {
  it("is closed on Shabbat and after the Friday cut-off, open on a weekday", () => {
    expect(closedReason(policy, new Date("2026-11-14T10:00:00Z"))).toBe("shabbat"); // Saturday
    expect(closedReason(policy, new Date("2026-11-13T12:30:00Z"))).toBe("shabbat"); // Friday 13:30 Budapest
    expect(closedReason(policy, new Date("2026-11-11T10:00:00Z"))).toBeNull(); // Wednesday 11:00
    expect(closedReason(policy, new Date("2026-11-11T22:00:00Z"))).toBe("closed_hours"); // 23:00
  });
  it("is closed on Yom Kippur 5787 (21 Sep 2026)", () => {
    expect(closedReason(policy, new Date("2026-09-21T09:00:00Z"))).toBe("yom_tov");
  });
  it("computes the next hilula (yahrzeit) in the Gregorian calendar", () => {
    const h = nextHilula(3, 2, 5685, new Date("2026-11-14T00:00:00Z")); // 3 Iyar
    expect(h).not.toBeNull();
    expect(h!.date.getFullYear()).toBe(2027);
    expect(h!.hebrew.getMonth()).toBe(2);
  });
});

describe("search transliteration", () => {
  it("matches Lizhensk / Lizensk / Leżajsk-style variants by consonant skeleton", () => {
    expect(latinSkeleton("Lizhensk")).toBe(latinSkeleton("Lizensk"));
    expect(latinSkeleton("Kerestir")).toBe(latinSkeleton("Keresztir"));
  });
});

describe("input validation", () => {
  it("rejects oversized requests and unknown templates", () => {
    const base = { template: "classic", nusach: "he", graveDisplayName: "x", people: [], topics: [], request: "a", showBH: true };
    expect(kvittelContentSchema.safeParse(base).success).toBe(true);
    expect(kvittelContentSchema.safeParse({ ...base, request: "a".repeat(5000) }).success).toBe(false);
    expect(kvittelContentSchema.safeParse({ ...base, template: "<script>" }).success).toBe(false);
  });
  it("checkout requires explicit terms acceptance and an empty honeypot", () => {
    const entry = { id: "e1", graveSlugs: ["kerestir"], content: { template: "classic", nusach: "he", graveDisplayName: "x", people: [], topics: [], request: "a", showBH: true } };
    const ok = { entries: [entry], email: "a@example.com", currency: "USD", marketingConsent: false, acceptTerms: true, locale: "he" };
    expect(checkoutSchema.safeParse(ok).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...ok, acceptTerms: false }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, website: "spam" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, currency: "BTC" }).success).toBe(false);
  });
});

import { detectNusach } from "@/lib/nusach";

describe("note language follows the text", () => {
  it("Hebrew text → he, Cyrillic → ru, Latin → site language or en, empty → site language", () => {
    expect(detectNusach("ישראל בן שרה", "en")).toBe("he");
    expect(detectNusach("Александр", "he")).toBe("ru");
    expect(detectNusach("Yisroel ben Sarah", "he")).toBe("en");
    expect(detectNusach("Élodie", "fr")).toBe("fr");
    expect(detectNusach("", "he")).toBe("he");
  });
});

describe("demo mode can never be on by accident", () => {
  const load = async (env: Record<string, string | undefined>) => {
    const saved = { ...process.env };
    for (const k of ["KVITTEL_DEMO_MODE", "DATABASE_URL", "RAILWAY_ENVIRONMENT", "RAILWAY_PROJECT_ID"]) delete process.env[k];
    Object.assign(process.env, env);
    const { vi } = await import("vitest");
    vi.resetModules();
    const m = await import("@/server/env");
    process.env = saved;
    return m;
  };
  it("is off when the variable is absent", async () => expect((await load({})).env.demoMode).toBe(false));
  it("is off with a real database or on Railway even if requested", async () => {
    expect((await load({ KVITTEL_DEMO_MODE: "1", DATABASE_URL: "postgres://x" })).env.demoMode).toBe(false);
    expect((await load({ KVITTEL_DEMO_MODE: "1", RAILWAY_ENVIRONMENT: "production" })).env.demoMode).toBe(false);
  });
  it("is on only when explicitly requested locally", async () => expect((await load({ KVITTEL_DEMO_MODE: "1" })).env.demoMode).toBe(true));
  it("commerce is unavailable without real payments + mail", async () => {
    const m = await load({});
    expect(m.commerceReady()).toBe(false);
  });
});

/**
 * Isomorphic device simulator — speaks the real Device Protocol v1 over HTTP.
 * Runs in the browser (Admin → Device Lab) and in Node (apps/device-simulator CLI).
 * It is a DEMO stand-in for real hardware and is always labelled as such.
 */

export interface SimKnobs {
  /** false = internet loss: every request fails */
  online: boolean;
  paper: "ok" | "near_end" | "paper_end";
  cover: "closed" | "open";
  cutterJam: boolean;
  /** chute sensor never fires → chute_timeout */
  chuteSensorFail: boolean;
  /** false = mains lost, running on battery (simulated UPS HAT) */
  acPower: boolean;
  /** report every job event twice (idempotency check) */
  doubleCallback: boolean;
  /** next job: power is cut after print_started; device reboots and reports `interrupted` */
  rebootMidPrint: boolean;
  /** first event POST after printing is "lost" and later retried from the outbox */
  dropAckOnce: boolean;
  printDelayMs: number;
  chuteDelayMs: number;
}

export const DEFAULT_KNOBS: SimKnobs = {
  online: true,
  paper: "ok",
  cover: "closed",
  cutterJam: false,
  chuteSensorFail: false,
  acPower: true,
  doubleCallback: false,
  rebootMidPrint: false,
  dropAckOnce: false,
  printDelayMs: 900,
  chuteDelayMs: 500,
};

export interface SimLogEntry {
  at: string;
  level: "info" | "warn" | "error";
  msg: string;
}

export interface PrintedSlip {
  jobId: string;
  commandId: string;
  widthDots: number;
  bytesPerRow: number;
  heightDots: number;
  data: string; // base64 packed raster
  isTest: boolean;
  at: string;
}

interface JobEventBody {
  leaseId: string;
  eventUid: string;
  type: string;
  at: string;
  data?: Record<string, unknown>;
}

interface Command {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  expiresAt: string;
  signature: string;
}

export interface SimOptions {
  server: string;
  token: string;
  deviceId: string;
  commandKey?: string;
  fetchImpl?: typeof fetch;
  onLog?: (e: SimLogEntry) => void;
  onPrint?: (slip: PrintedSlip) => void;
  onChange?: () => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .filter((k) => o[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(",")}}`;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function verifyCommandSignature(cmd: Command, commandKeyB64: string): Promise<boolean> {
  const msg = `${cmd.id}.${cmd.type}.${cmd.expiresAt}.${await sha256Hex(canonicalJson(cmd.payload ?? {}))}`;
  const key = await globalThis.crypto.subtle.importKey("raw", b64ToBytes(commandKeyB64) as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === cmd.signature;
}

export class SimulatedDevice {
  knobs: SimKnobs = { ...DEFAULT_KNOBS };
  seq = 0;
  bootId = uid();
  bootedAt = Date.now();
  paused = false;
  phase: "idle" | "leasing" | "printing" | "cutting" | "waiting_chute" | "offline" | "rebooting" = "idle";
  lastHeartbeatOk: boolean | null = null;
  lastError: string | null = null;
  /** commandId → last local state; persisted in-memory (browser) — the Python agent uses an fsynced file */
  journal = new Map<string, { jobId: string; leaseId: string; state: "leased" | "released" | "printing" | "done" }>();
  outbox: Array<{ jobId: string; body: JobEventBody }> = [];
  printed: PrintedSlip[] = [];
  log: SimLogEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  private droppedAck = false;

  constructor(private opts: SimOptions) {}

  private emit(level: SimLogEntry["level"], msg: string) {
    const e = { at: new Date().toISOString(), level, msg };
    this.log.unshift(e);
    this.log = this.log.slice(0, 200);
    this.opts.onLog?.(e);
    this.opts.onChange?.();
  }

  private async call<T>(path: string, body: unknown): Promise<{ status: number; data: T | null }> {
    if (!this.knobs.online) throw new Error("network_unreachable (simulated internet loss)");
    const f = this.opts.fetchImpl ?? fetch;
    const res = await f(`${this.opts.server}/api/device/v1${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.opts.token}` },
      body: JSON.stringify(body ?? {}),
    });
    const text = await res.text();
    return { status: res.status, data: text ? (JSON.parse(text) as T) : null };
  }

  telemetry() {
    return {
      network: "wifi",
      signalDbm: -55 - Math.round(Math.random() * 12),
      latencyMs: 30 + Math.round(Math.random() * 80),
      power: this.knobs.acPower ? "ac" : "battery",
      batteryPct: this.knobs.acPower ? 100 : Math.max(5, 100 - Math.round((Date.now() - this.bootedAt) / 60000)),
      paperSensor: this.knobs.paper,
      cover: this.knobs.cover,
      cutter: this.knobs.cutterJam ? "fault" : "ok",
      chuteSensor: this.knobs.chuteSensorFail ? "fault" : "ok",
      camera: "not_installed",
      tempC: 22,
      uptimeS: Math.round((Date.now() - this.bootedAt) / 1000),
      queueDepth: this.outbox.length,
      agentVersion: "0.1.0-sim",
      capabilities: { power: "supported", battery: "supported", nearEnd: "supported", cutterStatus: "supported", chuteSensor: "supported", camera: "unsupported" },
    };
  }

  async heartbeat(): Promise<{ jobAvailable: boolean; commands: Command[] } | null> {
    try {
      const r = await this.call<{ paused: boolean; jobAvailable: boolean; commands: Command[] }>("/heartbeat", {
        seq: ++this.seq,
        agentVersion: "0.1.0-sim",
        bootId: this.bootId,
        telemetry: this.telemetry(),
        activeJob: null,
      });
      if (r.status === 401) {
        this.lastHeartbeatOk = false;
        this.emit("error", "heartbeat rejected: 401 (token invalid or revoked)");
        return null;
      }
      this.lastHeartbeatOk = r.status === 200;
      this.paused = !!r.data?.paused;
      if (this.phase === "offline") this.phase = "idle";
      return r.data ? { jobAvailable: r.data.jobAvailable, commands: r.data.commands ?? [] } : null;
    } catch (e) {
      this.lastHeartbeatOk = false;
      this.phase = "offline";
      this.emit("warn", `heartbeat failed: ${(e as Error).message}`);
      return null;
    }
  }

  private async sendEvent(jobId: string, body: JobEventBody): Promise<{ status: string; next: string } | null> {
    try {
      const r = await this.call<{ status: string; next: string }>(`/jobs/${jobId}/events`, body);
      if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
      return r.data;
    } catch (e) {
      this.outbox.push({ jobId, body });
      this.emit("warn", `event ${body.type} queued in outbox (${(e as Error).message})`);
      return null;
    }
  }

  private async jobEvent(jobId: string, leaseId: string, type: string, data?: Record<string, unknown>) {
    const body: JobEventBody = { leaseId, eventUid: uid(), type, at: new Date().toISOString(), data };
    if (this.knobs.dropAckOnce && !this.droppedAck && type === "print_completed") {
      this.droppedAck = true;
      this.outbox.push({ jobId, body });
      this.emit("warn", `simulated lost ack for ${type} — will retry from outbox`);
      return null;
    }
    const r = await this.sendEvent(jobId, body);
    if (this.knobs.doubleCallback) {
      const dup = await this.sendEvent(jobId, body);
      this.emit("info", `double callback sent for ${type} → server status ${dup?.status ?? "?"}`);
    }
    return r;
  }

  async flushOutbox() {
    while (this.outbox.length && this.knobs.online) {
      const item = this.outbox[0]!;
      try {
        const r = await this.call(`/jobs/${item.jobId}/events`, item.body);
        if (r.status >= 500) break;
        this.outbox.shift();
        this.emit("info", `outbox delivered ${item.body.type} (uid ${item.body.eventUid.slice(0, 8)})`);
      } catch {
        break;
      }
    }
  }

  async processCommands(cmds: Command[]) {
    for (const c of cmds) {
      let ok = true;
      if (this.opts.commandKey) ok = await verifyCommandSignature(c, this.opts.commandKey);
      if (!ok || Date.parse(c.expiresAt) < Date.now()) {
        this.emit("error", `command ${c.type} rejected (${ok ? "expired" : "bad_signature"})`);
        await this.call(`/commands/${c.id}/result`, { status: "failed", result: { message: ok ? "expired" : "bad_signature" } }).catch(() => {});
        continue;
      }
      this.emit("info", `command ${c.type} verified`);
      let result: Record<string, unknown> = { message: "ok" };
      switch (c.type) {
        case "pause":
          this.paused = true;
          break;
        case "resume":
          this.paused = false;
          break;
        case "clear_error":
          this.knobs.cutterJam = false;
          if (this.knobs.paper === "paper_end") this.knobs.paper = "ok";
          this.knobs.cover = "closed";
          break;
        case "diagnostics":
          result = { telemetry: this.telemetry(), journalSize: this.journal.size, outbox: this.outbox.length };
          break;
        case "reboot_agent":
        case "restart_service":
          await this.reboot();
          break;
        default:
          break; // test_print arrives as a print job; config_update/ota handled as no-ops in sim
      }
      await this.call(`/commands/${c.id}/result`, { status: "succeeded", result }).catch(() => {});
    }
  }

  /** Simulated power cycle: in-flight print is lost, journal survives (as on disk). */
  async reboot() {
    this.phase = "rebooting";
    this.emit("warn", "rebooting agent…");
    await sleep(400);
    this.bootId = uid();
    this.bootedAt = Date.now();
    for (const [commandId, j] of this.journal) {
      if (j.state === "printing") {
        this.emit("warn", `journal: ${commandId.slice(0, 12)} was printing at power loss → reporting interrupted`);
        await this.jobEvent(j.jobId, j.leaseId, "interrupted", { reason: "power_loss_or_reboot" });
        j.state = "done";
      }
    }
    this.phase = "idle";
    await this.call("/events", { events: [{ eventUid: uid(), type: "boot", severity: "info", at: new Date().toISOString(), data: { bootId: this.bootId } }] }).catch(() => {});
  }

  async processOneJob(): Promise<boolean> {
    if (this.paused) return false;
    this.phase = "leasing";
    let r;
    try {
      r = await this.call<{ job: { jobId: string; commandId: string; leaseId: string; isTest: boolean; raster: { widthDots: number; bytesPerRow: number; pages: Array<{ heightDots: number; data: string }> } } }>("/jobs/lease", {});
    } catch (e) {
      this.phase = "offline";
      this.emit("warn", `lease failed: ${(e as Error).message}`);
      return false;
    }
    if (r.status === 204 || !r.data?.job) {
      this.phase = "idle";
      return false;
    }
    const job = r.data.job;
    const { jobId, leaseId, commandId } = job;
    const prev = this.journal.get(commandId)?.state;
    if (prev && prev !== "leased" && prev !== "released") {
      this.emit("error", `refusing to print ${commandId.slice(0, 12)} twice (journal)`);
      this.phase = "idle";
      return false;
    }
    this.journal.set(commandId, { jobId, leaseId, state: "leased" });
    this.emit("info", `leased job ${jobId.slice(0, 8)} (${job.raster.pages.length} page${job.raster.pages.length > 1 ? "s" : ""}${job.isTest ? ", TEST" : ""})`);

    // Pre-print checks: failing here is safe to retry elsewhere/later.
    const pre = this.knobs.paper === "paper_end" ? "paper_end" : this.knobs.cover === "open" ? "cover_open" : null;
    if (pre) {
      await this.jobEvent(jobId, leaseId, "failed", { error: pre, phase: "before_print" });
      this.journal.get(commandId)!.state = "released";
      this.emit("error", `cannot print: ${pre}`);
      this.phase = "idle";
      return true;
    }

    this.journal.get(commandId)!.state = "printing";
    this.phase = "printing";
    const started = await this.jobEvent(jobId, leaseId, "print_started");
    if (!started) {
      // Same rule as the Python agent: never print without an acknowledged print_started.
      this.outbox.push({ jobId, body: { leaseId, eventUid: uid(), type: "failed", at: new Date().toISOString(), data: { error: "other", phase: "before_print", reason: "print_started_unacked" } } });
      this.journal.get(commandId)!.state = "released";
      this.emit("warn", "print_started not acknowledged — not printing (safe retry)");
      this.phase = "idle";
      return true;
    }
    if (started.next === "stop") {
      this.emit("warn", "server says lease no longer valid — stopping");
      this.journal.get(commandId)!.state = "done";
      this.phase = "idle";
      return true;
    }
    if (this.knobs.rebootMidPrint) {
      this.knobs.rebootMidPrint = false;
      this.emit("error", "simulated power loss mid-print");
      await sleep(this.knobs.printDelayMs / 2);
      await this.reboot();
      return true;
    }
    for (const page of job.raster.pages) {
      await sleep(this.knobs.printDelayMs);
      const slip: PrintedSlip = { jobId, commandId, widthDots: job.raster.widthDots, bytesPerRow: job.raster.bytesPerRow, heightDots: page.heightDots, data: page.data, isTest: job.isTest, at: new Date().toISOString() };
      this.printed.unshift(slip);
      this.printed = this.printed.slice(0, 12);
      this.opts.onPrint?.(slip);
    }
    await this.jobEvent(jobId, leaseId, "print_completed");
    this.phase = "cutting";
    await sleep(250);
    if (this.knobs.cutterJam) {
      await this.jobEvent(jobId, leaseId, "failed", { error: "cutter_jam", phase: "after_print" });
      this.journal.get(commandId)!.state = "done";
      this.emit("error", "cutter jam after print → uncertain");
      this.phase = "idle";
      return true;
    }
    await this.jobEvent(jobId, leaseId, "cut_completed");
    this.phase = "waiting_chute";
    await sleep(this.knobs.chuteDelayMs);
    if (this.knobs.chuteSensorFail) await this.jobEvent(jobId, leaseId, "chute_timeout");
    else await this.jobEvent(jobId, leaseId, "chute_detected");
    this.journal.get(commandId)!.state = "done";
    this.emit(this.knobs.chuteSensorFail ? "error" : "info", this.knobs.chuteSensorFail ? "chute sensor timeout → uncertain" : `delivered ${jobId.slice(0, 8)} ✓ chute sensor`);
    this.phase = "idle";
    return true;
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const hb = await this.heartbeat();
      await this.flushOutbox();
      if (hb) {
        if (hb.commands.length) await this.processCommands(hb.commands);
        if (hb.jobAvailable) while (await this.processOneJob()) await this.flushOutbox();
      }
    } finally {
      this.busy = false;
      this.opts.onChange?.();
    }
  }

  start(intervalMs = 3000) {
    this.stop();
    const loop = async () => {
      await this.tick();
      this.timer = setTimeout(loop, intervalMs);
    };
    void loop();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  get running() {
    return this.timer !== null;
  }
}

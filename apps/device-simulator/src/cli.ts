/**
 * Headless DEMO device simulator.
 *   pnpm sim                         → runs all simulated devices from .data/sim-devices.json
 *   pnpm sim -- --device kerestir --chute-fail --paper near_end
 *   pnpm sim -- --once               → single tick per device (CI)
 * Requires the dev server (pnpm dev) to be running.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { SimulatedDevice, type SimKnobs } from "@kvittel/device-sim";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const val = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

let root = process.cwd();
while (!existsSync(path.join(root, "pnpm-workspace.yaml")) && path.dirname(root) !== root) root = path.dirname(root);
const file = path.join(root, ".data", "sim-devices.json");
if (!existsSync(file)) {
  console.error("No .data/sim-devices.json — run `pnpm setup` first.");
  process.exit(1);
}
const server = val("server") ?? process.env.KVITTEL_SERVER ?? "http://localhost:3000";
const all: Array<{ deviceId: string; token: string; grave: string; name: string }> = JSON.parse(readFileSync(file, "utf8"));
const only = val("device");
const list = all.filter((d) => !only || d.grave === only);

const knobs: Partial<SimKnobs> = {};
if (flag("offline")) knobs.online = false;
if (val("paper")) knobs.paper = val("paper") as SimKnobs["paper"];
if (flag("cover-open")) knobs.cover = "open";
if (flag("cutter-jam")) knobs.cutterJam = true;
if (flag("chute-fail")) knobs.chuteSensorFail = true;
if (flag("ac-off")) knobs.acPower = false;
if (flag("double-callback")) knobs.doubleCallback = true;
if (flag("reboot-mid-print")) knobs.rebootMidPrint = true;
if (flag("drop-ack")) knobs.dropAckOnce = true;

console.log(`DEMO simulator → ${server} · ${list.length} device(s)`);
for (const d of list) {
  const sim = new SimulatedDevice({
    server,
    token: d.token,
    deviceId: d.deviceId,
    onLog: (e) => console.log(`[${d.grave}] ${e.level.toUpperCase()} ${e.msg}`),
    onPrint: (s) => console.log(`[${d.grave}] 🧾 printed slip ${s.widthDots}×${s.heightDots} dots (job ${s.jobId.slice(0, 8)})`),
  });
  Object.assign(sim.knobs, knobs, { printDelayMs: 300, chuteDelayMs: 200 });
  if (flag("once")) await sim.tick();
  else sim.start(Number(val("interval") ?? 3000));
}

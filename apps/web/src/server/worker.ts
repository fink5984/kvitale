import { evaluateFleetHealth } from "./devices";
import { log } from "./log";
import { promoteScheduled, purgeExpiredContent, sweepExpiredLeases } from "./queue";

const g = globalThis as unknown as { __kvWorker?: ReturnType<typeof setInterval> };

export async function workerTick() {
  for (const [name, fn] of [
    ["sweepExpiredLeases", sweepExpiredLeases],
    ["promoteScheduled", promoteScheduled],
    ["evaluateFleetHealth", evaluateFleetHealth],
    ["purgeExpiredContent", purgeExpiredContent],
  ] as const) {
    try {
      await fn();
    } catch (e) {
      log.error("worker.task_failed", { task: name, err: (e as Error).message });
    }
  }
}

export function startWorker(intervalMs = Number(process.env.KVITTEL_WORKER_INTERVAL_MS ?? 30_000)) {
  if (g.__kvWorker) return;
  g.__kvWorker = setInterval(() => void workerTick(), intervalMs);
  setTimeout(() => void workerTick(), 5_000);
  log.info("worker.started", { intervalMs });
}

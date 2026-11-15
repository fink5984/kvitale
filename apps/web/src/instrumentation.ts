/**
 * Starts the in-process background worker (single instance / development).
 * In production run the same loop as a separate process (see docs/OPERATIONS.md)
 * and set KVITTEL_INPROCESS_WORKER=0 on web instances.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}

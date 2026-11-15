import { startWorker } from "./server/worker";

if (process.env.KVITTEL_INPROCESS_WORKER !== "0" && process.env.NEXT_PHASE !== "phase-production-build") startWorker();

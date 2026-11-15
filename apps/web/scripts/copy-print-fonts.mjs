// Serve the exact TTFs the server-side printer renderer uses, so the browser preview matches print output.
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
const src = path.resolve("../../packages/print-layout/fonts");
const dst = path.resolve("public/print-fonts");
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });

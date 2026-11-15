import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const config: NextConfig = {
  reactStrictMode: true,
  // Allows building into a separate folder while a dev server uses .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  transpilePackages: ["@kvittel/print-layout", "@kvittel/db", "@kvittel/device-sim"],
  serverExternalPackages: ["@electric-sql/pglite", "@napi-rs/canvas", "pg"],
  typedRoutes: false,
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(config);

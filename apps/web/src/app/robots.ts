import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/*/admin", "/*/operator", "/*/order/", "/*/pay/", "/*/account", "/*/checkout", "/*/cart", "/*/dev/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}

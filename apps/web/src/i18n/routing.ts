import { defineRouting } from "next-intl/routing";
import { ENABLED_LOCALES } from "./locales";

export const routing = defineRouting({
  locales: ENABLED_LOCALES,
  defaultLocale: "he",
  localePrefix: "always",
  localeCookie: { name: "NEXT_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});

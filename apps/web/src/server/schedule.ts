import "server-only";
import { flags, HDate, HebrewCalendar } from "@hebcal/core";

/**
 * Service windows per grave, evaluated in the grave's own IANA timezone.
 *
 * Shabbat / Yom Tov policy (conservative until verified coordinates allow
 * proper zmanim): no printing on the day itself, and none after the
 * configurable cut-off (default 12:00 local) on Friday / Erev Yom Tov.
 * Payment acceptance is decoupled: a paid kvittel waits as `scheduled`.
 */

export interface GraveServicePolicy {
  timezone: string;
  observeShabbat: boolean;
  observeYomTov: boolean;
  israelHolidays: boolean;
  shabbatCutoffMinute: number;
  schedules: Array<{ weekday: number; openMinute: number; closeMinute: number }>;
}

export type ClosedReason = "closed_hours" | "shabbat" | "yom_tov";

interface LocalParts {
  y: number;
  m: number;
  d: number;
  weekday: number; // 0 = Sunday
  minute: number; // minutes from local midnight
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
export function localParts(at: Date, tz: string): LocalParts {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" });
    fmtCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday!);
  return { y: +p.year!, m: +p.month!, d: +p.day!, weekday: wd, minute: +p.hour! * 60 + +p.minute! };
}

const chagCache = new Map<string, boolean>();
function isYomTov(y: number, m: number, d: number, il: boolean): boolean {
  const key = `${y}-${m}-${d}-${il ? 1 : 0}`;
  const hit = chagCache.get(key);
  if (hit !== undefined) return hit;
  const hd = new HDate(new Date(y, m - 1, d));
  const evs = HebrewCalendar.getHolidaysOnDate(hd, il) ?? [];
  const r = evs.some((e) => (e.getFlags() & flags.CHAG) !== 0);
  chagCache.set(key, r);
  return r;
}

function nextDay(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function closedReason(p: GraveServicePolicy, at: Date): ClosedReason | null {
  // Test-only escape hatch for E2E runs; ignored unless DEMO mode is on.
  if (process.env.KVITTEL_E2E_IGNORE_SCHEDULE === "1" && process.env.KVITTEL_DEMO_MODE === "1" && !process.env.DATABASE_URL) return null;
  const lp = localParts(at, p.timezone);
  if (p.observeShabbat) {
    if (lp.weekday === 6) return "shabbat";
    if (lp.weekday === 5 && lp.minute >= p.shabbatCutoffMinute) return "shabbat";
  }
  if (p.observeYomTov) {
    if (isYomTov(lp.y, lp.m, lp.d, p.israelHolidays)) return "yom_tov";
    const n = nextDay(lp.y, lp.m, lp.d);
    if (lp.minute >= p.shabbatCutoffMinute && isYomTov(n.y, n.m, n.d, p.israelHolidays)) return "yom_tov";
  }
  const today = p.schedules.filter((s) => s.weekday === lp.weekday);
  if (!today.some((s) => lp.minute >= s.openMinute && lp.minute < s.closeMinute)) return "closed_hours";
  return null;
}

/** First instant (15-min granularity) when printing is allowed, within 14 days. */
export function nextOpenAt(p: GraveServicePolicy, from: Date): Date | null {
  const step = 15 * 60000;
  let t = Math.ceil(from.getTime() / step) * step;
  const end = from.getTime() + 14 * 86400000;
  for (; t < end; t += step) if (!closedReason(p, new Date(t))) return new Date(t);
  return null;
}

/** Next Gregorian date of the hilula (yahrzeit rules incl. Adar in leap years via hebcal). */
export function nextHilula(day: number, month: number, yearOfPassing: number | null, from = new Date()): { date: Date; hebrew: HDate } | null {
  try {
    const todayH = new HDate(from);
    for (const hy of [todayH.getFullYear(), todayH.getFullYear() + 1]) {
      let hd: HDate | undefined;
      if (yearOfPassing) {
        const death = new HDate(day, month, yearOfPassing);
        hd = HebrewCalendar.getYahrzeit(hy, death) ?? undefined;
      } else {
        let mm = month;
        if (mm === 13 && !HDate.isLeapYear(hy)) mm = 12;
        hd = new HDate(day, mm, hy);
      }
      if (hd && hd.greg().getTime() >= new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) return { date: hd.greg(), hebrew: hd };
    }
  } catch {
    return null;
  }
  return null;
}

export function hebrewDateString(d: Date, locale: string): string {
  try {
    if (locale === "he" || locale === "yi") return new HDate(d).renderGematriya(true);
    return new HDate(d).render(locale === "ru" ? "ru" : locale === "fr" ? "fr" : "en", false);
  } catch {
    return "";
  }
}

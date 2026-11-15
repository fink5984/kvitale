import { and, asc, eq, isNull } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { deviceAssignments, devices, graveAliases, graveHilulot, graveMedia, graves, graveSchedules, graveTranslations, locations } from "@kvittel/db";
import { PageHeader } from "@/components/admin/kit";
import { GraveEditor } from "@/components/admin/GraveEditor";
import type { GraveInput } from "@/app/actions/admin";
import { guardPage } from "@/server/admin-guard";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

const LOCALES = ["he", "en", "fr", "ru", "yi", "es", "pt", "de"];

export default async function GraveEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const s = await guardPage(locale, "graves.read", `/admin/graves/${id}`);
  const t = await getTranslations("admin.graves");
  const db = await getDb();
  let input: GraveInput;
  let media: Array<{ id: string; credit: string | null; license: string | null; rightsVerified: boolean; width: number | null; height: number | null; role: string; focalX: number; focalY: number; alt: Record<string, string> | null }> = [];
  let assigned: Array<{ id: string; name: string }> = [];
  if (id === "new") {
    input = {
      slug: "",
      status: "discovery_only",
      timezone: "Europe/Budapest",
      countryCode: "HU",
      cityKey: "",
      lat: null,
      lng: null,
      locationVerified: false,
      dynasty: "",
      eraStartYear: null,
      eraEndYear: null,
      featured: false,
      sortOrder: 100,
      permitStatus: "none",
      observeShabbat: true,
      observeYomTov: true,
      israelHolidays: false,
      shabbatCutoffMinute: 720,
      published: false,
      translations: LOCALES.map((l) => ({ locale: l, name: "", reviewed: false })),
      aliases: [],
      schedules: [0, 1, 2, 3, 4].map((wd) => ({ weekday: wd, openMinute: 420, closeMinute: 1260 })).concat([{ weekday: 5, openMinute: 420, closeMinute: 720 }]),
      hilula: null,
    };
  } else {
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    const [g] = await db.select().from(graves).where(eq(graves.id, id));
    if (!g) notFound();
    const [loc] = g.locationId ? await db.select().from(locations).where(eq(locations.id, g.locationId)) : [];
    const tr = await db.select().from(graveTranslations).where(eq(graveTranslations.graveId, id));
    const al = await db.select().from(graveAliases).where(eq(graveAliases.graveId, id));
    const sc = await db.select().from(graveSchedules).where(eq(graveSchedules.graveId, id));
    const [h] = await db.select().from(graveHilulot).where(eq(graveHilulot.graveId, id));
    media = (await db.select().from(graveMedia).where(eq(graveMedia.graveId, id)).orderBy(asc(graveMedia.sortOrder), asc(graveMedia.createdAt))).map((m) => ({ id: m.id, credit: m.credit, license: m.license, rightsVerified: m.rightsVerified, width: m.width, height: m.height, role: m.role, focalX: m.focalX, focalY: m.focalY, alt: (m.alt as Record<string, string> | null) ?? null }));
    assigned = await db.select({ id: devices.id, name: devices.name }).from(deviceAssignments).innerJoin(devices, eq(devices.id, deviceAssignments.deviceId)).where(and(eq(deviceAssignments.graveId, id), isNull(deviceAssignments.unassignedAt)));
    const names = new Set(tr.map((x) => x.name));
    input = {
      id: g.id,
      slug: g.slug,
      status: g.status,
      timezone: g.timezone,
      countryCode: loc?.countryCode ?? "",
      cityKey: loc?.cityKey ?? "",
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
      locationVerified: loc?.verified ?? false,
      verificationSource: loc?.verificationSource ?? "",
      dynasty: g.dynasty ?? "",
      eraStartYear: g.eraStartYear,
      eraEndYear: g.eraEndYear,
      featured: g.featured,
      sortOrder: g.sortOrder,
      permitStatus: g.permitStatus,
      permitNotes: g.permitNotes ?? "",
      observeShabbat: g.observeShabbat,
      observeYomTov: g.observeYomTov,
      israelHolidays: g.israelHolidays,
      shabbatCutoffMinute: g.shabbatCutoffMinute,
      published: !!g.publishedAt,
      translations: LOCALES.map((l) => {
        const x = tr.find((y) => y.locale === l);
        return { locale: l, name: x?.name ?? "", epithet: x?.epithet ?? "", placeName: x?.placeName ?? "", address: x?.address ?? "", bio: x?.bio ?? "", bioSources: x?.bioSources ?? "", customs: x?.customs ?? "", metaTitle: x?.metaTitle ?? "", metaDescription: x?.metaDescription ?? "", reviewed: x?.reviewed ?? false };
      }),
      aliases: al.map((a) => a.alias).filter((a) => !names.has(a)),
      schedules: sc.map((x) => ({ weekday: x.weekday, openMinute: x.openMinute, closeMinute: x.closeMinute })),
      hilula: h ? { day: h.hebrewDay, month: h.hebrewMonth, year: h.hebrewYearOfPassing, verified: h.verified, sourceNote: h.sourceNote ?? "" } : null,
    };
  }
  const title = input.translations.find((x) => x.locale === locale)?.name || input.translations.find((x) => x.name)?.name || t("new");
  return (
    <>
      <PageHeader crumbs={[{ href: "/admin/graves", label: t("title") }, { label: title }]} title={<bdi>{title}</bdi>} description={t("editorDesc")} />
      <GraveEditor initial={input} media={media} assigned={assigned} canWrite={s.permissions.has("graves.write")} canPublish={s.permissions.has("graves.publish")} />
    </>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { RollWizard } from "@/components/operator/RollWizard";
import { DemoBadge } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { deviceRollView } from "@/server/operator-queries";

export const dynamic = "force-dynamic";

export default async function RollPage({ params }: { params: Promise<{ locale: string; deviceId: string }> }) {
  const { locale, deviceId } = await params;
  setRequestLocale(locale);
  const s = await requirePermission("operator.access");
  const v = await deviceRollView(s, deviceId, locale);
  if (!v) notFound();
  const t = await getTranslations("operator.roll");
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/operator" className="text-sm text-charcoal-500 hover:text-midnight-900">
        ← {t("backToUnits")}
      </Link>
      <div className="mb-8 mt-4">
        <p className="eyebrow text-gold-700">{t("eyebrow")}</p>
        <h1 className="font-display mt-2 text-[2rem] leading-tight text-midnight-900 sm:text-[2.4rem]">{t("title")}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-charcoal-600">
          <bdi>{v.graveName}</bdi> · {v.device.name} {v.device.isSimulated && <DemoBadge />}
        </p>
        {v.roll && (
          <p className="mt-3 text-xs text-charcoal-500">
            {t("current", { date: formatDate(v.roll.installedAt, locale), m: (v.roll.usedMm / 1000).toFixed(1) })}
            {v.paper && ` · ${t("remaining", { pct: Math.round(v.paper.remainingPct) })}`}
          </p>
        )}
      </div>
      <RollWizard deviceId={v.device.id} canTest={s.permissions.has("operator.test_print")} />
    </div>
  );
}

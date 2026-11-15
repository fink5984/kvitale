import { getTranslations, setRequestLocale } from "next-intl/server";
import { SimBadge } from "@/components/admin/fleet/bits";
import { ParamSelect } from "@/components/admin/fleet/FleetClient";
import { PageHeader, Panel, Table, Td } from "@/components/admin/kit";
import { Badge } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { activityFeed } from "@/server/fleet-queries";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ device?: string; type?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await guardPage(locale, "devices.read", "/admin/activity");
  const t = await getTranslations("admin.fleet");
  const tt = t as unknown as (k: string, v?: Record<string, string | number>) => string;
  const sp = await searchParams;
  const type = sp.type && /^[a-z_.]{2,40}$/.test(sp.type) ? sp.type : undefined;
  const feed = await activityFeed(locale, s.graveScope, { deviceId: sp.device, type });
  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("activity.title")} description={t("activity.description")} />
      <div className="mb-4 flex flex-wrap gap-2">
        <ParamSelect name="device" label={t("activity.colUnit")} value={sp.device ?? ""} options={[{ value: "", label: t("activity.allUnits") }, ...feed.devices.map((d) => ({ value: d.id, label: d.name }))]} />
        <ParamSelect name="type" label={t("activity.colType")} value={type ?? ""} options={[{ value: "", label: t("activity.allTypes") }, ...feed.types.map((x) => ({ value: x, label: x }))]} />
      </div>
      <Panel padded={false}>
        <Table head={[t("activity.colTime"), t("activity.colUnit"), t("activity.colType"), t("activity.colSeverity"), t("activity.colData")]} caption={t("activity.title")}>
          {feed.rows.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap text-xs text-charcoal-600 tabular">{formatDateTime(e.occurredAt, locale, undefined, { dateStyle: "short", timeStyle: "medium" })}</Td>
              <Td>
                <Link href={`/admin/devices/${e.deviceId}`} className="underline-offset-4 hover:underline">
                  {e.deviceName}
                </Link>
                {e.simulated && <span className="ms-2"><SimBadge t={tt} /></span>}
              </Td>
              <Td>
                <code className="font-mono text-[0.8rem]" dir="ltr">
                  {e.type}
                </code>
              </Td>
              <Td>
                <Badge tone={e.severity === "critical" ? "danger" : e.severity === "warning" ? "warning" : "neutral"}>{t(`alerts.severity.${e.severity}`)}</Badge>
              </Td>
              <Td className="max-w-md">
                <span className="block truncate font-mono text-[0.7rem] text-charcoal-500" dir="ltr">
                  {e.data
                    ? Object.entries(e.data)
                        .filter(([, v]) => v !== undefined && v !== null)
                        .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                        .join(" · ")
                    : ""}
                </span>
              </Td>
            </tr>
          ))}
        </Table>
        {feed.rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-charcoal-500">{t("activity.empty")}</p>}
      </Panel>
    </>
  );
}

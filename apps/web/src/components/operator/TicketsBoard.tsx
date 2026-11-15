"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { addTicketNote, createTicket, setTicketStatus } from "@/app/actions/operator";
import { Badge, Button, EmptyState, Field, Input, Modal, Notice, Select, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { formatDate, formatDateTime } from "@/lib/format";

interface Ticket {
  id: string;
  graveName: string;
  deviceName: string | null;
  kind: string;
  title: string;
  status: string;
  priority: number;
  dueAt: string | null;
  createdAt: string;
  closedAt: string | null;
  notes: Array<{ id: string; note: string; at: string }>;
}

const KINDS = ["paper_change", "cleaning", "battery", "sensor", "cutter", "other"] as const;
const STATUSES = ["open", "in_progress", "waiting_parts", "resolved", "closed"] as const;

export function TicketsBoard({ open, history, rollChanges, sites }: { open: Ticket[]; history: Ticket[]; rollChanges: Array<{ id: string; deviceName: string; installedAt: string; removedAt: string | null; usedMm: number }>; sites: Array<{ graveId: string; name: string; devices: Array<{ id: string; name: string }> }> }) {
  const t = useTranslations("operator.tickets");
  const locale = useLocale();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [graveId, setGraveId] = useState(sites[0]?.graveId ?? "");
  const [deviceId, setDeviceId] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("other");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const site = sites.find((s) => s.graveId === graveId);

  return (
    <div className="space-y-12">
      <section aria-labelledby="open-tickets">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="open-tickets" className="font-display text-2xl text-midnight-900">
            {t("open", { count: open.length })}
          </h2>
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)} disabled={!sites.length}>
            {t("new")}
          </Button>
        </div>
        {open.length === 0 ? <EmptyState title={t("noneOpen")} body={t("noneOpenBody")} /> : <ul className="space-y-4">{open.map((tk) => <TicketCard key={tk.id} tk={tk} />)}</ul>}
      </section>

      <section aria-labelledby="history">
        <h2 id="history" className="font-display mb-4 text-2xl text-midnight-900">
          {t("history")}
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <h3 className="text-sm font-semibold text-midnight-900">{t("resolved")}</h3>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-charcoal-500">{t("noHistory")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
                {history.slice(0, 30).map((h) => (
                  <li key={h.id} className="flex justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">{h.title}</span>
                    <span className="shrink-0 text-charcoal-500">{h.closedAt ? formatDate(h.closedAt, locale) : "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <h3 className="text-sm font-semibold text-midnight-900">{t("rollChanges")}</h3>
            <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
              {rollChanges.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">{r.deviceName}</span>
                  <span className="shrink-0 tabular text-charcoal-500">
                    {formatDate(r.installedAt, locale)} · {(r.usedMm / 1000).toFixed(1)} m
                    {!r.removedAt && <Badge tone="success" className="ms-2">{t("current")}</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Modal
        open={creating}
        onOpenChange={setCreating}
        title={t("new")}
        closeLabel={t("close")}
        footer={
          <Button
            loading={pending}
            disabled={title.trim().length < 3 || !graveId}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await createTicket({ graveId, deviceId: deviceId || undefined, kind, title, priority });
                if (r.ok) {
                  setCreating(false);
                  setTitle("");
                  router.refresh();
                } else setError(t(`errors.${r.error}`));
              })
            }
          >
            {t("create")}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={t("site")} htmlFor="tk-site">
            <Select id="tk-site" value={graveId} onChange={(e) => { setGraveId(e.target.value); setDeviceId(""); }}>
              {sites.map((s) => (
                <option key={s.graveId} value={s.graveId}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("unit")} htmlFor="tk-unit" optional={t("optional")}>
            <Select id="tk-unit" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              <option value="">—</option>
              {site?.devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("kind")} htmlFor="tk-kind">
              <Select id="tk-kind" value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("priority")} htmlFor="tk-prio">
              <Select id="tk-prio" value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
                {[1, 2, 3].map((p) => (
                  <option key={p} value={p}>
                    {t(`priorities.${p}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t("titleLabel")} htmlFor="tk-title" hint={t("noContentHint")}>
            <Input id="tk-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} dir="auto" />
          </Field>
          {error && <Notice tone="warning">{error}</Notice>}
        </div>
      </Modal>
    </div>
  );
}

function TicketCard({ tk }: { tk: Ticket }) {
  const t = useTranslations("operator.tickets");
  const locale = useLocale();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const overdue = tk.dueAt && Date.parse(tk.dueAt) < Date.now();
  return (
    <li className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-midnight-900">{tk.title}</p>
          <p className="mt-1 text-xs text-charcoal-500">
            <bdi>{tk.graveName}</bdi>
            {tk.deviceName && ` · ${tk.deviceName}`} · {t(`kinds.${tk.kind}`)} · {formatDate(tk.createdAt, locale)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={tk.priority === 1 ? "danger" : tk.priority === 2 ? "warning" : "neutral"}>{t(`priorities.${tk.priority}`)}</Badge>
          {tk.dueAt && <Badge tone={overdue ? "danger" : "info"}>{t(overdue ? "overdue" : "due", { date: formatDate(tk.dueAt, locale) })}</Badge>}
        </div>
      </div>
      {tk.notes.length > 0 && (
        <ol className="mt-4 space-y-2 border-s-2 border-gold-400/50 ps-4 text-sm">
          {tk.notes.map((n) => (
            <li key={n.id}>
              <p className="text-charcoal-800" dir="auto">{n.note}</p>
              <p className="text-[0.7rem] text-charcoal-500">{formatDateTime(n.at, locale)}</p>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`note-${tk.id}`}>
          {t("addNote")}
        </label>
        <Textarea id={`note-${tk.id}`} rows={2} className="min-h-0 flex-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePh")} dir="auto" />
        <Button
          size="sm"
          variant="outline"
          loading={pending}
          disabled={note.trim().length < 2}
          onClick={() =>
            start(async () => {
              const r = await addTicketNote(tk.id, note);
              if (r.ok) {
                setNote("");
                router.refresh();
              }
            })
          }
        >
          {t("addNote")}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor={`st-${tk.id}`} className="text-xs text-charcoal-500">
          {t("status")}
        </label>
        <Select
          id={`st-${tk.id}`}
          className="h-9 w-auto text-sm"
          value={tk.status}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              await setTicketStatus(tk.id, e.target.value as (typeof STATUSES)[number]);
              router.refresh();
            })
          }
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </Select>
      </div>
    </li>
  );
}

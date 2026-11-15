"use client";

import { Check, Copy, MessageSquarePlus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  acknowledgeAlert,
  addTicketNote,
  createPairing,
  createTicket,
  issueDeviceCommand,
  reassignDevice,
  recordRollChange,
  resolveAlertAction,
  revokeDeviceAction,
  unassignDevice,
  updateTicket,
} from "@/app/actions/admin-fleet";
import { Button, Field, Input, Modal, Notice, Select, Textarea } from "@/components/ui";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/format";

type R = { ok: true } | { ok: false; error: string };

function useAction() {
  const t = useTranslations("admin.fleet");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const run = (fn: () => Promise<R>, okText?: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setMsg(okText ? { tone: "success", text: okText } : null);
        after?.();
        router.refresh();
      } else setMsg({ tone: "warning", text: t(`errors.${r.error}` as "errors.invalid") });
    });
  return { pending, msg, run, t };
}

/* ───────────── commands ───────────── */

const CMDS = ["test_print", "pause", "resume", "diagnostics", "clear_error", "reboot_agent"] as const;

export function CommandButtons({ deviceId, paused, disabled }: { deviceId: string; paused: boolean; disabled?: boolean }) {
  const { pending, msg, run, t } = useAction();
  const [reboot, setReboot] = useState(false);
  const [reason, setReason] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CMDS.filter((c) => (paused ? c !== "pause" : c !== "resume")).map((c) => (
          <Button
            key={c}
            size="sm"
            variant={c === "test_print" ? "primary" : c === "reboot_agent" ? "outline" : "quiet"}
            disabled={pending || disabled}
            onClick={() => {
              if (c === "reboot_agent") return setReboot(true);
              if (c === "clear_error") return setClearConfirm(true);
              run(() => issueDeviceCommand({ deviceId, type: c }), t("detail.cmdIssued"));
            }}
          >
            {t(`detail.cmd.${c}`)}
          </Button>
        ))}
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Modal
        open={reboot}
        onOpenChange={setReboot}
        title={t("detail.cmd.reboot_agent")}
        footer={
          <Button loading={pending} disabled={reason.trim().length < 3} onClick={() => run(() => issueDeviceCommand({ deviceId, type: "reboot_agent", reason }), t("detail.cmdIssued"), () => { setReboot(false); setReason(""); })}>
            {t("detail.cmd.reboot_agent")}
          </Button>
        }
      >
        <Field label={t("detail.rebootReason")} htmlFor="reboot-reason">
          <Input id="reboot-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
      <Modal
        open={clearConfirm}
        onOpenChange={setClearConfirm}
        title={t("detail.cmd.clear_error")}
        description={t("detail.clearErrorHint")}
        footer={
          <Button loading={pending} onClick={() => run(() => issueDeviceCommand({ deviceId, type: "clear_error" }), t("detail.cmdIssued"), () => setClearConfirm(false))}>
            {t("detail.cmd.clear_error")}
          </Button>
        }
      >
        <span />
      </Modal>
    </div>
  );
}

/* ───────────── paper ───────────── */

export function RollChangeForm({ deviceId }: { deviceId: string }) {
  const { pending, msg, run, t } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ outer: "40", core: "12", thickness: "0.06", nominal: "", note: "" });
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t("detail.rollChange")}
      </Button>
      {msg && <Notice tone={msg.tone} className="mt-3">{msg.text}</Notice>}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t("detail.rollChange")}
        description={t("detail.rollHint")}
        footer={
          <Button
            loading={pending}
            onClick={() =>
              run(
                () => recordRollChange({ deviceId, outerDiameterMm: Number(v.outer), coreDiameterMm: Number(v.core), thicknessMm: Number(v.thickness), nominalLengthMm: v.nominal ? Number(v.nominal) : undefined, note: v.note || undefined }),
                t("detail.rollSaved"),
                () => setOpen(false),
              )
            }
          >
            {t("detail.rollChange")}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["outer", "detail.outer"],
              ["core", "detail.core"],
              ["thickness", "detail.thickness"],
              ["nominal", "detail.nominal"],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={t(label)} htmlFor={`roll-${k}`}>
              <Input id={`roll-${k}`} inputMode="decimal" dir="ltr" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
            </Field>
          ))}
          <Field label={t("detail.note")} htmlFor="roll-note" className="sm:col-span-2">
            <Input id="roll-note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

/* ───────────── credentials & assignment ───────────── */

export function RevokeButton({ deviceId, disabled }: { deviceId: string; disabled?: boolean }) {
  const { pending, msg, run, t } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <>
      <Button size="sm" variant="danger" disabled={disabled} onClick={() => setOpen(true)}>
        {t("detail.revoke")}
      </Button>
      {msg && <Notice tone={msg.tone} className="mt-3">{msg.text}</Notice>}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t("detail.revokeTitle")}
        description={t("detail.revokeBody")}
        footer={
          <Button variant="danger" loading={pending} disabled={reason.trim().length < 3} onClick={() => run(() => revokeDeviceAction({ deviceId, reason }), undefined, () => setOpen(false))}>
            {t("detail.revokeConfirm")}
          </Button>
        }
      >
        <Field label={t("detail.note")} htmlFor="revoke-reason">
          <Input id="revoke-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}

export function AssignmentForm({ deviceId, graves, currentGraveId }: { deviceId: string; graves: Array<{ id: string; name: string }>; currentGraveId: string | null }) {
  const { pending, msg, run, t } = useAction();
  const [graveId, setGraveId] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        <Field label={t("detail.reassignTo")} htmlFor="reassign-grave">
          <Select id="reassign-grave" value={graveId} onChange={(e) => setGraveId(e.target.value)}>
            <option value="">—</option>
            {graves
              .filter((g) => g.id !== currentGraveId)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label={t("detail.note")} htmlFor="reassign-note">
          <Input id="reassign-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button size="md" disabled={!graveId} loading={pending} onClick={() => run(() => reassignDevice({ deviceId, graveId, note }), t("detail.assignSaved"), () => setGraveId(""))}>
            {t("detail.reassign")}
          </Button>
          {currentGraveId && (
            <Button size="md" variant="ghost" disabled={pending || note.trim().length < 3} onClick={() => run(() => unassignDevice({ deviceId, reason: note }), t("detail.assignSaved"))}>
              {t("detail.unassign")}
            </Button>
          )}
        </div>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}

/* ───────────── pairing ───────────── */

export function PairForm({ graves }: { graves: Array<{ id: string; name: string }> }) {
  const { t } = useAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [graveId, setGraveId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<{ code: string; expiresAt: string; qrSvg: string; server: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!res) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [res]);
  const left = res ? Math.max(0, Date.parse(res.expiresAt) - now) : 0;
  const mmss = `${String(Math.floor(left / 60000)).padStart(2, "0")}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
  const cmd = res ? `kvittel-agent pair --code ${res.code} --server ${res.server}` : "";
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const r = await createPairing({ graveId, deviceName: name });
            if (r.ok) {
              setRes({ code: r.code, expiresAt: r.expiresAt, qrSvg: r.qrSvg, server: r.server });
              router.refresh();
            } else setError(t(`errors.${r.error}` as "errors.invalid"));
          });
        }}
      >
        <Field label={t("pair.grave")} htmlFor="pair-grave">
          <Select id="pair-grave" required value={graveId} onChange={(e) => setGraveId(e.target.value)}>
            <option value="">{t("pair.chooseGrave")}</option>
            {graves.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("pair.deviceName")} htmlFor="pair-name">
          <Input id="pair-name" required minLength={2} maxLength={80} placeholder={t("pair.deviceNamePh")} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {error && <Notice tone="warning">{error}</Notice>}
        <Button type="submit" loading={pending} disabled={!graveId || name.trim().length < 2} icon={<Plus className="size-4" />}>
          {t("pair.create")}
        </Button>
      </form>
      <div className={cn("rounded-xl border border-[var(--line)] p-6", res ? "tex-stone" : "border-dashed bg-ivory-50/60")}>
        {res ? (
          <div className="flex flex-col items-center text-center">
            <p className="eyebrow text-gold-700">{t("pair.codeTitle")}</p>
            <p className="mt-3 font-mono text-4xl font-semibold tracking-[0.18em] text-midnight-900 sm:text-5xl" dir="ltr" data-testid="pairing-code">
              {res.code}
            </p>
            <p className={cn("mt-2 text-sm tabular", left ? "text-charcoal-600" : "text-oxblood-600")}>{left ? t("pair.expiresIn", { time: mmss }) : t("pair.expired")}</p>
            <div className={cn("mt-5 w-48 rounded-lg bg-ivory-50 p-2 shadow-soft ring-1 ring-stone-300 [&_svg]:h-auto [&_svg]:w-full", !left && "opacity-30")} role="img" aria-label={t("pair.qrAria")} dangerouslySetInnerHTML={{ __html: res.qrSvg }} />
            <div className="mt-5 flex w-full items-center gap-2 rounded-md bg-midnight-900 px-3 py-2 text-start font-mono text-[0.72rem] text-gold-200" dir="ltr">
              <code className="min-w-0 flex-1 break-all">{cmd}</code>
              <button
                type="button"
                className="grid size-7 shrink-0 place-items-center rounded hover:bg-ivory-50/10"
                aria-label="Copy"
                onClick={() => {
                  navigator.clipboard?.writeText(cmd).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-48 items-center justify-center text-center text-sm text-charcoal-500">{t("pair.description")}</div>
        )}
      </div>
    </div>
  );
}

/* ───────────── alerts & tickets ───────────── */

export function AlertActions({ id, status }: { id: string; status: string }) {
  const { pending, msg, run, t } = useAction();
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status === "open" && (
        <Button size="sm" variant="quiet" disabled={pending} onClick={() => run(() => acknowledgeAlert(id))}>
          {t("alerts.ack")}
        </Button>
      )}
      {status !== "resolved" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => resolveAlertAction({ id }))}>
          {t("alerts.resolve")}
        </Button>
      )}
      {msg && <span className="text-xs text-oxblood-600">{msg.text}</span>}
    </div>
  );
}

export function NewTicket({ devices, assignees, alertId, defaultTitle, defaultDeviceId, trigger }: { devices: Array<{ id: string; name: string }>; assignees: Array<{ id: string; label: string }>; alertId?: string; defaultTitle?: string; defaultDeviceId?: string; trigger?: ReactNode }) {
  const { pending, msg, run, t } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: defaultTitle ?? "", kind: "other", priority: "2", deviceId: defaultDeviceId ?? "", assigneeUserId: "", due: "" });
  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger ?? (
          <Button size="sm" icon={<Plus className="size-4" />}>
            {t("alerts.newTicket")}
          </Button>
        )}
      </span>
      {msg && msg.tone === "warning" && <Notice tone="warning" className="mt-2">{msg.text}</Notice>}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t("alerts.newTicket")}
        wide
        footer={
          <Button
            loading={pending}
            disabled={v.title.trim().length < 3}
            onClick={() =>
              run(
                () => createTicket({ title: v.title, kind: v.kind as "other", priority: Number(v.priority), deviceId: v.deviceId, alertId: alertId ?? "", assigneeUserId: v.assigneeUserId, dueInHours: v.due ? Number(v.due) : undefined }),
                t("alerts.ticketCreated"),
                () => setOpen(false),
              )
            }
          >
            {t("alerts.newTicket")}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("alerts.ticketTitle")} htmlFor="tk-title" className="sm:col-span-2">
            <Input id="tk-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </Field>
          <Field label={t("alerts.ticketKind")} htmlFor="tk-kind">
            <Select id="tk-kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
              {["paper_change", "cleaning", "battery", "sensor", "cutter", "other"].map((k) => (
                <option key={k} value={k}>
                  {t(`alerts.ticketKinds.${k}` as "alerts.ticketKinds.other")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("alerts.ticketPriority")} htmlFor="tk-prio">
            <Select id="tk-prio" value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value })}>
              {["1", "2", "3"].map((p) => (
                <option key={p} value={p}>
                  {t(`alerts.priorities.${p}` as "alerts.priorities.1")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("alerts.ticketUnit")} htmlFor="tk-dev">
            <Select id="tk-dev" value={v.deviceId} onChange={(e) => setV({ ...v, deviceId: e.target.value })}>
              <option value="">{t("alerts.noUnit")}</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("alerts.ticketAssignee")} htmlFor="tk-assignee">
            <Select id="tk-assignee" value={v.assigneeUserId} onChange={(e) => setV({ ...v, assigneeUserId: e.target.value })}>
              <option value="">{t("alerts.unassigned")}</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("alerts.ticketDue")} hint={t("alerts.ticketDueHint")} htmlFor="tk-due" className="sm:col-span-2">
            <Input id="tk-due" inputMode="numeric" dir="ltr" value={v.due} onChange={(e) => setV({ ...v, due: e.target.value.replace(/\D/g, "") })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

export function TicketControls({ id, status, assigneeId, assignees }: { id: string; status: string; assigneeId: string | null; assignees: Array<{ id: string; label: string }> }) {
  const { pending, msg, run, t } = useAction();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`st-${id}`}>
        {t("alerts.colState")}
      </label>
      <Select id={`st-${id}`} className="h-9 w-auto text-sm" value={status} disabled={pending} onChange={(e) => run(() => updateTicket({ id, status: e.target.value as "open" }))}>
        {["open", "in_progress", "waiting_parts", "resolved", "closed"].map((s) => (
          <option key={s} value={s}>
            {t(`alerts.ticketStatus.${s}` as "alerts.ticketStatus.open")}
          </option>
        ))}
      </Select>
      <label className="sr-only" htmlFor={`as-${id}`}>
        {t("alerts.colAssignee")}
      </label>
      <Select id={`as-${id}`} className="h-9 w-auto max-w-44 text-sm" value={assigneeId ?? ""} disabled={pending} onChange={(e) => run(() => updateTicket({ id, assigneeUserId: e.target.value || null }))}>
        <option value="">{t("alerts.unassigned")}</option>
        {assignees.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </Select>
      <Button size="sm" variant="ghost" icon={<MessageSquarePlus className="size-4" />} onClick={() => setNoteOpen(true)}>
        {t("alerts.addNote")}
      </Button>
      {msg && <span className="text-xs text-oxblood-600">{msg.text}</span>}
      <Modal
        open={noteOpen}
        onOpenChange={setNoteOpen}
        title={t("alerts.addNote")}
        footer={
          <Button loading={pending} disabled={!note.trim()} onClick={() => run(() => addTicketNote({ id, note }), undefined, () => { setNoteOpen(false); setNote(""); })}>
            {t("alerts.addNote")}
          </Button>
        }
      >
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("alerts.notePh")} aria-label={t("alerts.addNote")} />
      </Modal>
    </div>
  );
}

/** URL-driven <select> filter (works for any searchParam). */
export function ParamSelect({ name, value, options, label }: { name: string; value: string; options: Array<{ value: string; label: string }>; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">{label}</span>
      <Select
        className="h-9 w-auto min-w-40 text-sm"
        value={value}
        onChange={(e) => {
          const n = new URLSearchParams(sp.toString());
          if (e.target.value) n.set(name, e.target.value);
          else n.delete(name);
          router.replace(`${pathname}?${n.toString()}`, { scroll: false });
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

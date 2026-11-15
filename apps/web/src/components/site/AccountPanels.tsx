"use client";

import { Download, LogOut, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { claimGuestOrders, deleteMyAccount, deleteNamesGroup, exportMyData, listNamesGroups, saveNamesGroup, updatePreferences } from "@/app/actions/account";
import { signOut } from "@/app/actions/public";
import { Button, Checkbox, Field, Input, Modal, Notice } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { newId, store } from "@/lib/store";

type Group = Awaited<ReturnType<typeof listNamesGroups>>[number];

export function ClaimPanel({ count }: { count: number }) {
  const t = useTranslations("account.dashboard");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Notice tone="gold" className="mt-4">
      {t("claim", { count })}{" "}
      <Button size="sm" variant="outline" className="ms-2" loading={pending} onClick={() => start(async () => { await claimGuestOrders(); router.refresh(); })}>
        {t("claimCta")}
      </Button>
    </Notice>
  );
}

export function NamesPanel() {
  const t = useTranslations("account.names");
  const router = useRouter();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [lines, setLines] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, start] = useTransition();
  const reload = () => listNamesGroups().then(setGroups);
  useEffect(() => {
    reload();
  }, []);
  return (
    <section aria-labelledby="names">
      <div className="flex items-center justify-between">
        <h2 id="names" className="font-display text-2xl text-midnight-900">{t("title")}</h2>
        <Button size="sm" variant="quiet" onClick={() => setOpen(true)}>{t("add")}</Button>
      </div>
      <p className="mt-1 text-xs text-charcoal-500">{t("privacy")}</p>
      <ul className="mt-4 space-y-2">
        {groups?.length === 0 && <li className="text-sm text-charcoal-500">{t("empty")}</li>}
        {groups?.map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-ivory-50 px-4 py-3">
            <span>
              <span className="font-medium">{g.groupName}</span>
              <span className="ms-2 text-xs text-charcoal-500">{t("count", { count: g.people.length })}</span>
            </span>
            <span className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => {
                const d = store.get().draft;
                const base = d ?? { graveSlugs: [], editingEntryId: null, content: { template: "classic" as const, nusach: "he" as const, graveDisplayName: "", people: [], topics: [], request: "", signature: "", showBH: true } };
                store.setDraft({ ...base, content: { ...base.content, people: [...base.content.people.filter((p) => p.given || p.freeText), ...g.people.map((p) => ({ ...p, id: newId() }))] } });
                router.push("/write");
              }}>{t("use")}</Button>
              <Button size="sm" variant="ghost" aria-label={t("delete")} onClick={() => start(async () => { await deleteNamesGroup(g.id); reload(); })}><Trash2 className="size-4" /></Button>
            </span>
          </li>
        ))}
      </ul>
      <Modal open={open} onOpenChange={setOpen} title={t("add")} footer={
        <Button loading={pending} disabled={!consent || !name || !lines.trim()} onClick={() => start(async () => {
          const people = lines.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => ({ id: newId(), mode: "free" as const, given: "", relation: "none" as const, freeText: l }));
          const r = await saveNamesGroup({ groupName: name, people, consent: true });
          if (r.ok) { setOpen(false); setName(""); setLines(""); setConsent(false); reload(); }
        })}>{t("save")}</Button>
      }>
        <div className="space-y-4">
          <Field label={t("groupName")} htmlFor="gn"><Input id="gn" value={name} onChange={(e) => setName(e.target.value)} dir="auto" /></Field>
          <Field label={t("lines")} hint={t("linesHint")} htmlFor="gl"><textarea id="gl" rows={6} className="w-full rounded-md border border-[var(--line-strong)] bg-ivory-50 p-3" value={lines} onChange={(e) => setLines(e.target.value)} dir="auto" /></Field>
          <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label={t("consent")} />
        </div>
      </Modal>
    </section>
  );
}

export function SettingsPanel({ email }: { email: string }) {
  const t = useTranslations("account.settings");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState("");
  const [del, setDel] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <section aria-labelledby="settings" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <h2 id="settings" className="font-display text-2xl text-midnight-900">{t("title")}</h2>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => start(async () => { await updatePreferences({ marketing: true, locale }); setSaved(t("marketingOn")); })}>{t("marketingOptIn")}</Button>
          <Button size="sm" variant="outline" onClick={() => start(async () => { await updatePreferences({ marketing: false }); setSaved(t("marketingOff")); })}>{t("marketingOptOut")}</Button>
        </div>
        {saved && <p role="status" className="text-sage-600">{saved}</p>}
        <Button size="sm" variant="quiet" icon={<Download className="size-4" />} loading={pending} onClick={() => start(async () => {
          const data = await exportMyData();
          const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
          const a = document.createElement("a");
          a.href = url; a.download = "kvittel-my-data.json"; a.click(); URL.revokeObjectURL(url);
        })}>{t("export")}</Button>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="ghost" icon={<LogOut className="size-4" />} onClick={() => start(async () => { await signOut(); window.location.href = `/${locale}`; })}>{t("signOut")}</Button>
          <Button size="sm" variant="ghost" className="text-oxblood-600" icon={<Trash2 className="size-4" />} onClick={() => setDel(true)}>{t("delete")}</Button>
        </div>
      </div>
      <Modal open={del} onOpenChange={setDel} title={t("deleteTitle")} description={t("deleteBody")} footer={
        <Button variant="danger" disabled={confirm.trim().toLowerCase() !== email} loading={pending} onClick={() => start(async () => { const r = await deleteMyAccount(confirm); if (r.ok) window.location.href = `/${locale}`; })}>{t("deleteConfirm")}</Button>
      }>
        <Field label={t("typeEmail")} htmlFor="del-email"><Input id="del-email" value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" /></Field>
      </Modal>
    </section>
  );
}


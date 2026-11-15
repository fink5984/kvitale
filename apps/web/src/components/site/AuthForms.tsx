"use client";

import { Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { demoSignIn, requestGrave, requestMagicLink, verifyMagicCode, verifyMagicToken } from "@/app/actions/public";
import { Button, Field, Input, Notice, Textarea } from "@/components/ui";
import { Link } from "@/i18n/navigation";

export function LoginForm({ next, demoUsers }: { next?: string; demoUsers: Array<{ email: string; role: string }> | null }) {
  const t = useTranslations("account.login");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = (n: string) => (window.location.href = `/${locale}${n === "/" ? "" : n}`);

  return (
    <div className="space-y-8">
      {!sent ? (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await requestMagicLink({ email, locale, next });
              if (r.ok) setSent(true);
              else setError(t(`errors.${r.error}`));
            });
          }}
        >
          <Field label={t("email")} htmlFor="login-email" hint={t("emailHint")}>
            <Input id="login-email" type="email" required autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={pending} icon={<Mail className="size-4" />}>
            {t("send")}
          </Button>
        </form>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await verifyMagicCode({ email, code, locale });
              if (r.ok) go(r.next);
              else setError(t(`errors.${r.error}`));
            });
          }}
        >
          <Notice tone="success">{t("sent", { email })}</Notice>
          <Field label={t("code")} htmlFor="login-code">
            <Input id="login-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" className="text-center font-mono text-2xl tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={pending} disabled={code.length !== 6}>
            {t("verify")}
          </Button>
          <button type="button" className="text-sm text-charcoal-500 underline" onClick={() => setSent(false)}>
            {t("changeEmail")}
          </button>
        </form>
      )}
      {error && <Notice tone="warning">{error}</Notice>}
      {demoUsers && (
        <div className="rounded-xl border border-dashed border-ochre-600/40 bg-ochre-100/40 p-5">
          <p className="font-mono text-xs font-semibold tracking-[0.15em] text-ochre-600">DEMO</p>
          <p className="mt-1 text-sm text-charcoal-700">{t("demo")}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {demoUsers.map((u) => (
              <button
                key={u.email}
                type="button"
                className="rounded-lg border border-[var(--line)] bg-ivory-50 px-3 py-2 text-start text-sm hover:border-gold-500"
                onClick={() =>
                  start(async () => {
                    const r = await demoSignIn(u.email);
                    if (r.ok) go(r.next);
                  })
                }
              >
                <span className="block font-medium">{t(`roles.${u.role}`)}</span>
                <span className="block truncate font-mono text-[0.7rem] text-charcoal-500" dir="ltr">
                  {u.email}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-charcoal-500">
            {t("mailbox")}{" "}
            <Link href="/dev/mailbox" className="underline">
              /dev/mailbox
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

export function VerifyToken({ token }: { token: string }) {
  const t = useTranslations("account.login");
  const locale = useLocale();
  const [error, setError] = useState(false);
  useEffect(() => {
    verifyMagicToken(token, locale).then((r) => {
      if (r.ok) window.location.href = `/${locale}${r.next}`;
      else setError(true);
    });
  }, [token, locale]);
  return error ? <Notice tone="warning">{t("errors.invalid_link")}</Notice> : <p className="text-charcoal-600">{t("verifying")}</p>;
}

export function RequestGraveForm({ initialName }: { initialName?: string }) {
  const t = useTranslations("public.requestGrave");
  const locale = useLocale();
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <Notice tone="success" title={t("thanksTitle")}>{t("thanks")}</Notice>;
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await requestGrave({ name: String(fd.get("name") ?? ""), location: String(fd.get("location") ?? ""), email: String(fd.get("email") ?? ""), locale, website: String(fd.get("website") ?? "") });
          if (r.ok) setDone(true);
          else setError(true);
        });
      }}
    >
      <Field label={t("name")} htmlFor="rg-name">
        <Input id="rg-name" name="name" required minLength={2} defaultValue={initialName} dir="auto" />
      </Field>
      <Field label={t("location")} htmlFor="rg-loc" optional={t("optional")}>
        <Textarea id="rg-loc" name="location" rows={3} dir="auto" className="min-h-0" />
      </Field>
      <Field label={t("email")} htmlFor="rg-email" optional={t("optional")} hint={t("emailHint")}>
        <Input id="rg-email" name="email" type="email" dir="ltr" />
      </Field>
      <input name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      {error && <Notice tone="warning">{t("error")}</Notice>}
      <Button type="submit" loading={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}

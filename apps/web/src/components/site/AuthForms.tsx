"use client";

import { Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { requestGrave, requestMagicLink, verifyMagicCode, verifyMagicToken } from "@/app/actions/public";
import { Button, Field, Input, Notice, Textarea } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
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

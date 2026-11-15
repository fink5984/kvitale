"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { demoPay } from "@/app/actions/public";
import { Button, Notice } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";

export function DemoPayActions({ providerRef, orderRef, status }: { providerRef: string; orderRef: string; status: string }) {
  const t = useTranslations("commerce.demoPay");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const run = (o: "succeed" | "decline" | "replay") =>
    start(async () => {
      const r = await demoPay(providerRef, o);
      setResult(r.ok ? (r as { outcome?: string }).outcome ?? "ok" : "error");
      if (o === "succeed" && r.ok) router.push(`/order/${orderRef}`);
    });
  return (
    <div className="mt-8 space-y-3">
      <Button className="w-full" size="lg" loading={pending} onClick={() => run("succeed")} disabled={status === "succeeded"}>
        {t("succeed")}
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => run("decline")} disabled={pending || status === "succeeded"}>
          {t("decline")}
        </Button>
        <Button variant="ghost" onClick={() => run("replay")} disabled={pending}>
          {t("replay")}
        </Button>
      </div>
      {result && (
        <Notice tone={result === "error" ? "warning" : "info"}>
          {t("webhookOutcome")} <code className="font-mono">{result}</code>
        </Notice>
      )}
      {status === "succeeded" && (
        <Button variant="quiet" className="w-full" onClick={() => router.push(`/order/${orderRef}`)}>
          {t("toOrder")}
        </Button>
      )}
    </div>
  );
}

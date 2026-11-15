"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { operatorTestPrint } from "@/app/actions/operator";
import { Button } from "@/components/ui";

export function TestPrintButton({ deviceId, disabled }: { deviceId: string; disabled?: boolean }) {
  const t = useTranslations("operator.units");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        loading={pending}
        icon={<Printer className="size-4" />}
        onClick={() =>
          start(async () => {
            if (!confirm(t("testPrintConfirm"))) return;
            const r = await operatorTestPrint(deviceId);
            setMsg(r.ok ? { ok: true, text: t("testPrintQueued") } : { ok: false, text: t(`errors.${r.error}`) });
          })
        }
      >
        {t("testPrint")}
      </Button>
      {msg && (
        <p role="status" className={msg.ok ? "text-xs text-sage-600" : "text-xs text-oxblood-600"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { registerDemand } from "@/app/actions/public";

export function DemandButton({ slug }: { slug: string }) {
  const t = useTranslations("public.grave");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done)
    return (
      <p role="status" className="inline-flex items-center gap-2 text-sm font-medium text-sage-600">
        <Check className="size-4" /> {t("demand.thanks")}
      </p>
    );
  return (
    <Button variant="outline" loading={pending} onClick={() => start(async () => setDone((await registerDemand(slug)).ok))}>
      {t("demand.cta")}
    </Button>
  );
}

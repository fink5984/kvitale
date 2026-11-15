import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";

export default async function Forbidden() {
  const t = await getTranslations("admin.common");
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <ShieldAlert className="mx-auto size-10 text-gold-600" strokeWidth={1.3} />
      <h1 className="font-display mt-6 text-4xl">{t("forbiddenTitle")}</h1>
      <p className="mt-3 text-charcoal-600">{t("forbiddenBody")}</p>
    </div>
  );
}

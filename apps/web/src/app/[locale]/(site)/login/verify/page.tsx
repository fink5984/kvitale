import { setRequestLocale } from "next-intl/server";
import { VerifyToken } from "@/components/site/AuthForms";

export const dynamic = "force-dynamic";

export default async function VerifyPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-[var(--gutter)] py-24 text-center">
      <VerifyToken token={token ?? ""} />
    </div>
  );
}

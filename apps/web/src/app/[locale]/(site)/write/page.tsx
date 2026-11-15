import { redirect } from "@/i18n/navigation";

/** Legacy entry point. Writing now happens on the tzaddik's own page, so old links keep working. */
export default async function WritePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ grave?: string }> }) {
  const { locale } = await params;
  const { grave } = await searchParams;
  redirect({ href: grave && /^[a-z0-9-]{1,80}$/.test(grave) ? `/graves/${grave}` : "/graves", locale });
}

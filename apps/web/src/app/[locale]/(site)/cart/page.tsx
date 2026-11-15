import { redirect } from "@/i18n/navigation";

/** The basket and the payment summary are one screen now. */
export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/checkout", locale });
}

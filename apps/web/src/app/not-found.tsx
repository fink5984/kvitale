import Link from "next/link";
import { fontVars } from "@/lib/fonts";

export default function GlobalNotFound() {
  return (
    <html lang="en" className={fontVars}>
      <body className="tex-night grid min-h-dvh place-items-center text-ivory-100">
        <div className="text-center">
          <p className="eyebrow text-gold-300">404</p>
          <h1 className="font-display mt-3 text-5xl">Page not found</h1>
          <p className="mt-4">
            <Link className="text-gold-300 underline underline-offset-4" href="/">
              Kvittel · קוויטל
            </Link>
          </p>
        </div>
      </body>
    </html>
  );
}

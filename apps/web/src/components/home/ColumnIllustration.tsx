import { getTranslations } from "next-intl/server";

/**
 * Technical line drawing of the field unit (conceptual ~24×24×100 cm column):
 * thermal printer → full cut → closed chute → optical sensor → kvittel opening.
 * Labels are localized; proportions are conceptual, not an engineering drawing.
 */
export async function ColumnIllustration({ className }: { className?: string }) {
  const t = await getTranslations("public.home.proof.diagram");
  const label = (x: number, y: number, text: string, anchor: "start" | "end" | "middle" = "start") => (
    <text x={x} y={y} fill="#E0C385" fillOpacity=".85" fontSize="12" textAnchor={anchor} style={{ fontFamily: "var(--font-sans)", letterSpacing: ".04em" }}>
      {text}
    </text>
  );
  return (
    <svg viewBox="-175 0 650 640" className={className} direction="ltr" role="img" aria-label={t("aria")}>
      <defs>
        <linearGradient id="col-body" x1="0" x2="1">
          <stop offset="0" stopColor="#1D3152" />
          <stop offset=".5" stopColor="#2B4369" />
          <stop offset="1" stopColor="#14233D" />
        </linearGradient>
        <linearGradient id="col-beam" x1="0" x2="1">
          <stop offset="0" stopColor="#E0C385" stopOpacity="0" />
          <stop offset=".5" stopColor="#E0C385" stopOpacity=".9" />
          <stop offset="1" stopColor="#E0C385" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* ground & grave wall */}
      <path d="M0 600h420" stroke="#CFAA63" strokeOpacity=".35" />
      <path d="M268 600V250c0-40 30-70 66-78 36 8 66 38 66 78v350" fill="#0F1B30" stroke="#CFAA63" strokeOpacity=".5" />
      <rect x="306" y="452" width="56" height="7" rx="3.5" fill="#020509" stroke="#E0C385" strokeOpacity=".7" />
      {label(334, 486, t("opening"), "middle")}

      {/* column */}
      <g>
        <rect x="70" y="120" width="120" height="480" rx="6" fill="url(#col-body)" stroke="#CFAA63" strokeOpacity=".55" />
        <rect x="70" y="120" width="120" height="16" rx="6" fill="#2B4369" stroke="#CFAA63" strokeOpacity=".4" />
        {/* printer */}
        <rect x="88" y="168" width="84" height="64" rx="4" fill="#0B1424" stroke="#E0C385" strokeOpacity=".8" />
        <circle cx="130" cy="200" r="13" fill="none" stroke="#E0C385" strokeOpacity=".6" />
        <circle cx="130" cy="200" r="4" fill="#E0C385" fillOpacity=".7" />
        <rect x="104" y="234" width="52" height="4" fill="#FBF9F3" />
        {/* paper slip inside */}
        <path d="M110 238h40v46l-20 6-20-6z" fill="#FBF9F3" opacity=".95" />
        <path d="M116 250h28M116 258h22M116 266h26" stroke="#2B4369" strokeOpacity=".6" />
        {/* cutter */}
        <path d="M96 300h68" stroke="#E0C385" strokeDasharray="4 3" />
        {/* chute */}
        <path d="M120 312h20l140 136v14h-26L120 326z" fill="#0B1424" stroke="#E0C385" strokeOpacity=".7" />
        {/* optical sensor beam */}
        <rect x="246" y="420" width="10" height="34" rx="2" fill="#1D3152" stroke="#E0C385" strokeOpacity=".7" transform="rotate(-44 251 437)" />
        <path d="M222 428l44 0" stroke="url(#col-beam)" strokeWidth="3" className="animate-flicker" />
        {/* service drawer & lock */}
        <rect x="84" y="470" width="92" height="90" rx="3" fill="none" stroke="#CFAA63" strokeOpacity=".35" />
        <circle cx="166" cy="515" r="3.5" fill="none" stroke="#CFAA63" strokeOpacity=".6" />
        {/* modem antenna */}
        <path d="M176 120V92" stroke="#CFAA63" strokeOpacity=".6" />
        <circle cx="176" cy="88" r="3" fill="#CFAA63" fillOpacity=".7" />
      </g>

      {/* leader lines + labels */}
      <g stroke="#E0C385" strokeOpacity=".35">
        <path d="M88 200H30" />
        <path d="M96 300H30" />
        <path d="M200 380l-40-50" />
        <path d="M244 432L210 520" />
        <path d="M84 515H30" />
        <path d="M176 92h40" />
      </g>
      {label(26, 196, t("printer"), "end")}
      {label(26, 296, t("cutter"), "end")}
      {label(206, 392, t("chute"))}
      {label(196, 538, t("sensor"))}
      {label(26, 511, t("drawer"), "end")}
      {label(222, 96, t("modem"))}
      <text x="130" y="626" fill="#E0C385" fillOpacity=".5" fontSize="11" textAnchor="middle" style={{ fontFamily: "var(--font-sans)" }}>
        ≈ 24 × 24 × 100 cm
      </text>
    </svg>
  );
}

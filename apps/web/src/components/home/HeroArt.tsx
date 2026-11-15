/**
 * Hero illustration: a Jerusalem-limestone arch at night, a candle's warmth at
 * its foot, and a folded kvittel descending into the opening. Pure SVG/CSS —
 * no stock imagery, no depiction of any specific real tombstone.
 */
export function HeroArt({ className }: { className?: string }) {
  const courses = [118, 168, 218, 268, 318, 368, 418, 468, 518];
  return (
    <div className={className} aria-hidden>
      <svg viewBox="0 0 520 620" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id="ha-glow" cx="50%" cy="88%" r="60%">
            <stop offset="0%" stopColor="#E0C385" stopOpacity=".55" />
            <stop offset="35%" stopColor="#B38D48" stopOpacity=".18" />
            <stop offset="100%" stopColor="#0B1424" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ha-stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D3152" />
            <stop offset="100%" stopColor="#0F1B30" />
          </linearGradient>
          <linearGradient id="ha-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ECD8A6" />
            <stop offset="60%" stopColor="#CFAA63" />
            <stop offset="100%" stopColor="#8F6E33" />
          </linearGradient>
          <clipPath id="ha-arch">
            <path d="M70 620V250C70 130 150 46 260 26c110 20 190 104 190 224v370z" />
          </clipPath>
          <clipPath id="ha-inner">
            <path d="M150 620V268c0-80 46-140 110-158 64 18 110 78 110 158v352z" />
          </clipPath>
          <filter id="ha-soft">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>

        {/* warm candle light */}
        <ellipse cx="260" cy="560" rx="260" ry="200" fill="url(#ha-glow)" className="origin-[50%_90%] animate-flicker" />

        {/* outer stone with courses */}
        <g clipPath="url(#ha-arch)">
          <rect x="0" y="0" width="520" height="620" fill="url(#ha-stone)" opacity=".9" />
          {courses.map((y, i) => (
            <g key={y} stroke="#E0C385" strokeOpacity=".09" strokeWidth="1">
              <line x1="0" y1={y} x2="520" y2={y} />
              {[0, 1, 2, 3, 4].map((k) => (
                <line key={k} x1={(i % 2 ? 40 : 90) + k * 110} y1={y} x2={(i % 2 ? 40 : 90) + k * 110} y2={y + 50} />
              ))}
            </g>
          ))}
        </g>
        {/* inner niche — the opening */}
        <g clipPath="url(#ha-inner)">
          <rect x="0" y="0" width="520" height="620" fill="#070D18" />
          <rect x="0" y="380" width="520" height="240" fill="url(#ha-glow)" opacity=".7" />
        </g>

        {/* hairline gold outlines */}
        <path d="M70 620V250C70 130 150 46 260 26c110 20 190 104 190 224v370" fill="none" stroke="url(#ha-gold)" strokeWidth="1.4" />
        <path d="M150 620V268c0-80 46-140 110-158 64 18 110 78 110 158v352" fill="none" stroke="url(#ha-gold)" strokeWidth="1" strokeOpacity=".7" />
        <path d="M110 620V258c0-100 64-170 150-190 86 20 150 90 150 190v362" fill="none" stroke="#E0C385" strokeOpacity=".18" strokeWidth=".8" strokeDasharray="2 6" />
        <circle cx="260" cy="190" r="5" fill="url(#ha-gold)" />
        <path d="M244 190h-30M276 190h30" stroke="#CFAA63" strokeOpacity=".6" />

        {/* the slot in the niche wall */}
        <rect x="210" y="452" width="100" height="8" rx="4" fill="#020509" stroke="#CFAA63" strokeOpacity=".5" />

        {/* descending kvittel */}
        <g className="hero-kvittel">
          <g transform="translate(232 300)">
            <path d="M0 12l28-12 28 12v58l-28 12-28-12z" fill="#FBF9F3" />
            <path d="M0 12l28 12 28-12" fill="none" stroke="#B38D48" strokeWidth=".9" />
            <path d="M28 24v58" stroke="#D2C3A3" strokeWidth=".8" />
            <g stroke="#2B4369" strokeOpacity=".55" strokeWidth="1.1" strokeLinecap="round">
              <path d="M8 38h14M8 46h16M8 54h12M34 36h14M34 44h12M34 52h15" />
            </g>
          </g>
        </g>

        {/* candle */}
        <g transform="translate(372 520)">
          <ellipse cx="10" cy="-12" rx="22" ry="26" fill="#E0C385" opacity=".25" filter="url(#ha-soft)" className="animate-flicker" />
          <path d="M10 -26c4 6 6 10 0 16-6-6-4-10 0-16z" fill="#F6ECD2" className="origin-[10px_-10px] animate-flicker" />
          <rect x="2" y="-8" width="16" height="58" rx="2" fill="#ECE3D0" />
          <rect x="2" y="-8" width="16" height="4" rx="2" fill="#FDFBF6" />
        </g>
        <line x1="0" y1="619.5" x2="520" y2="619.5" stroke="#CFAA63" strokeOpacity=".35" />
      </svg>
    </div>
  );
}

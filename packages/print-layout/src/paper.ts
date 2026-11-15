/**
 * Paper-length accounting for thermal rolls.
 *
 * Remaining length is estimated from the roll geometry at install time minus
 * everything printed/fed since. The estimate carries an explicit uncertainty
 * band; the hardware near-end sensor (when present) is used as a cross-check,
 * never replaced by a made-up percentage.
 */

export interface RollSpec {
  outerDiameterMm: number;
  coreDiameterMm: number;
  paperThicknessMm: number;
  /** Optional nominal length printed on the roll packaging */
  nominalLengthMm?: number;
}

/** Spiral length ≈ π (D² − d²) / (4 t) */
export function rollLengthMm(spec: RollSpec): number {
  const { outerDiameterMm: D, coreDiameterMm: d, paperThicknessMm: t } = spec;
  if (t <= 0 || D <= d) return 0;
  return (Math.PI * (D * D - d * d)) / (4 * t);
}

export interface PaperEstimate {
  totalMm: number;
  usedMm: number;
  remainingMm: number;
  remainingPct: number;
  /** ± percentage points */
  uncertaintyPct: number;
  /** near-end sensor reading if hardware exposes it */
  nearEndSensor: "ok" | "near_end" | "unsupported" | "unknown";
  /** Days until empty from rolling demand; null when demand unknown */
  daysToEmpty: number | null;
  confidence: "measured" | "estimated" | "low";
}

export function estimatePaper(input: {
  spec: RollSpec;
  usedMm: number;
  calibrationFactor?: number; // learned from previous rolls (actual/estimated)
  nearEndSensor?: PaperEstimate["nearEndSensor"];
  avgDailyUsageMm?: number | null;
  /** multiplier for upcoming peak demand, e.g. hilula in window */
  demandMultiplier?: number;
}): PaperEstimate {
  const geomLen = rollLengthMm(input.spec);
  const base = input.spec.nominalLengthMm ?? geomLen;
  const totalMm = base * (input.calibrationFactor ?? 1);
  const usedMm = Math.max(0, input.usedMm);
  const remainingMm = Math.max(0, totalMm - usedMm);
  const remainingPct = totalMm > 0 ? (remainingMm / totalMm) * 100 : 0;
  // Uncertainty: ±4% of roll from diameter/thickness tolerance, smaller if calibrated.
  const uncertaintyPct = input.calibrationFactor ? 2.5 : 5;
  const sensor = input.nearEndSensor ?? "unknown";
  let daysToEmpty: number | null = null;
  if (input.avgDailyUsageMm && input.avgDailyUsageMm > 0) {
    daysToEmpty = remainingMm / (input.avgDailyUsageMm * (input.demandMultiplier ?? 1));
    daysToEmpty = Math.round(daysToEmpty * 10) / 10;
  }
  let pct = remainingPct;
  // If the hardware says near-end, the estimate cannot be higher than the sensor threshold zone.
  if (sensor === "near_end" && pct > 12) pct = 12;
  return {
    totalMm: Math.round(totalMm),
    usedMm: Math.round(usedMm),
    remainingMm: Math.round(remainingMm),
    remainingPct: Math.round(pct * 10) / 10,
    uncertaintyPct,
    nearEndSensor: sensor,
    daysToEmpty,
    confidence: sensor === "near_end" ? "measured" : input.calibrationFactor ? "estimated" : "low",
  };
}

/** Alert when the roll will run out before a technician can reasonably arrive. */
export function needsPaperAlert(est: PaperEstimate, serviceLeadDays: number): { alert: boolean; reason: "near_end" | "days_to_empty" | "low_pct" | null } {
  if (est.nearEndSensor === "near_end") return { alert: true, reason: "near_end" };
  if (est.daysToEmpty !== null && est.daysToEmpty <= serviceLeadDays) return { alert: true, reason: "days_to_empty" };
  if (est.remainingPct - est.uncertaintyPct <= 10) return { alert: true, reason: "low_pct" };
  return { alert: false, reason: null };
}

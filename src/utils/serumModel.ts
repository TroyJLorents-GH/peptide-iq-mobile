import type { DoseLog, Compound, SerumDataPoint } from '../types';

/**
 * Pharmacokinetic model with absorption phase + half-life decay + dose stacking.
 *
 * For each dose:
 *   - Absorption phase (0 → Tmax): concentration ramps up
 *   - Peak: dose reaches Cmax = doseMcg * bioavailability
 *   - Elimination phase (after Tmax): exponential decay based on half-life
 *     remaining = Cmax * (0.5 ^ (hoursAfterPeak / halfLifeHours))
 *
 * Multiple doses stack — the total concentration at any time is the sum
 * of remaining concentration from ALL prior doses.
 *
 * Example: Retatrutide 1mg weekly, half-life 144h (6 days)
 *   Day 0 (Mon): inject 1mg → peak ~1mg
 *   Day 4 (Fri): 1.0 * 0.5^(96/144) = ~0.63mg remains
 *   Day 6 (Sun): 1.0 * 0.5^(144/144) = 0.50mg remains (exactly half)
 *   Day 7 (Mon): inject again → new 1mg + ~0.45mg from last week = stacking
 *   Steady state reached after ~4-5 half-lives (~1 month for retatrutide)
 *
 * This produces an ESTIMATED concentration curve, not a measured lab value.
 */

export type GraphMode = 'concentration' | 'bodyLoad';

/**
 * Concentration mode: accounts for bioavailability + absorption curve
 *   Peak = dose * bioavailability, then decay
 *
 * Body Load mode: simple remaining drug calculation
 *   N(t) = N0 * 0.5^(t/h)
 *   "How much of my 1mg shot is still in me?"
 */
function getConcentrationFromDose(
  doseMcg: number,
  bioavailability: number,
  halfLifeHours: number,
  tmaxHours: number,
  hoursSinceDose: number,
  mode: GraphMode = 'concentration',
): number {
  if (hoursSinceDose < 0) return 0;

  if (mode === 'bodyLoad') {
    // Simple decay: N(t) = N0 * 0.5^(t/h)
    // No absorption phase, no bioavailability — just "how much drug remains"
    // Convert mcg to mg for display
    const doseMg = doseMcg / 1000;
    return doseMg * Math.pow(0.5, hoursSinceDose / halfLifeHours);
  }

  // Concentration mode — full PK model
  const cmax = doseMcg * bioavailability;

  if (hoursSinceDose <= tmaxHours) {
    const absorptionRate = 3 / tmaxHours;
    return cmax * (1 - Math.exp(-absorptionRate * hoursSinceDose));
  }

  const hoursAfterPeak = hoursSinceDose - tmaxHours;
  return cmax * Math.pow(0.5, hoursAfterPeak / halfLifeHours);
}

export function calculateSerumCurve(
  doses: DoseLog[],
  compound: Compound,
  startTime: number,
  endTime: number,
  pointsCount = 200,
  mode: GraphMode = 'concentration',
): SerumDataPoint[] {
  const { halfLifeHours, bioavailability, tmaxHours } = compound.pk;

  const step = (endTime - startTime) / pointsCount;
  const points: SerumDataPoint[] = [];

  const parsedDoses = doses.map(d => ({
    time: new Date(d.timestamp).getTime(),
    mcg: d.doseMcg,
  }));

  for (let i = 0; i <= pointsCount; i++) {
    const t = startTime + step * i;
    let concentration = 0;

    for (const dose of parsedDoses) {
      if (dose.time > t) continue;

      const hoursSinceDose = (t - dose.time) / (1000 * 60 * 60);
      if (hoursSinceDose > halfLifeHours * 10) continue;

      concentration += getConcentrationFromDose(
        dose.mcg,
        bioavailability,
        halfLifeHours,
        tmaxHours,
        hoursSinceDose,
        mode,
      );
    }

    points.push({
      timestamp: t,
      concentration: Math.round(concentration * 1000) / 1000,
      compoundId: compound.id,
    });
  }

  return points;
}

/**
 * Check if user has likely reached steady state.
 * Steady state is reached after ~4-5 half-lives of consistent dosing.
 */
export function isAtSteadyState(
  doses: DoseLog[],
  compound: Compound,
): boolean {
  if (!compound.pk.steadyStateDays) return false;
  if (doses.length === 0) return false;

  const firstDose = new Date(doses[0].timestamp).getTime();
  const now = Date.now();
  const daysSinceFirst = (now - firstDose) / (1000 * 60 * 60 * 24);

  return daysSinceFirst >= compound.pk.steadyStateDays;
}

/**
 * Get current estimated concentration for a compound (sum of all active doses).
 */
export function getCurrentConcentration(
  doses: DoseLog[],
  compound: Compound,
  mode: GraphMode = 'concentration',
): number {
  const now = Date.now();
  const { halfLifeHours, bioavailability, tmaxHours } = compound.pk;

  let concentration = 0;

  for (const dose of doses) {
    const doseTime = new Date(dose.timestamp).getTime();
    if (doseTime > now) continue;

    const hoursSinceDose = (now - doseTime) / (1000 * 60 * 60);
    if (hoursSinceDose > halfLifeHours * 10) continue;

    concentration += getConcentrationFromDose(
      dose.doseMcg,
      bioavailability,
      halfLifeHours,
      tmaxHours,
      hoursSinceDose,
      mode,
    );
  }

  return Math.round(concentration * 1000) / 1000;
}

/**
 * Calculate concentration at a specific point in time for a compound.
 * Used for computing daily peak/trough ranges.
 */
export function calculatePointConcentration(
  doses: DoseLog[],
  compound: Compound,
  timeMs: number,
  mode: GraphMode = 'concentration',
): number {
  const { halfLifeHours, bioavailability, tmaxHours } = compound.pk;
  let concentration = 0;

  for (const dose of doses) {
    const doseTime = new Date(dose.timestamp).getTime();
    if (doseTime > timeMs) continue;

    const hoursSinceDose = (timeMs - doseTime) / (1000 * 60 * 60);
    if (hoursSinceDose > halfLifeHours * 10) continue;

    concentration += getConcentrationFromDose(
      dose.doseMcg,
      bioavailability,
      halfLifeHours,
      tmaxHours,
      hoursSinceDose,
      mode,
    );
  }

  return Math.round(concentration * 1000) / 1000;
}

import type { CalculatorResult } from '../types';

/**
 * Calculate peptide reconstitution and syringe dosing.
 *
 * Formula:
 *   concentration = (vialStrengthMg * 1000) / waterVolumeMl   [mcg/mL]
 *   drawVolumeMl  = desiredDoseMcg / concentration             [mL]
 *   syringeUnits  = drawVolumeMl * 100                         [units on U-100]
 *   dosesPerVial  = (vialStrengthMg * 1000) / desiredDoseMcg
 */
export function calculateDose(
  desiredDoseMcg: number,
  vialStrengthMg: number,
  waterVolumeMl: number,
): CalculatorResult {
  const totalMcg = vialStrengthMg * 1000;
  const concentrationMcgPerMl = totalMcg / waterVolumeMl;
  const concentrationMgPerMl = vialStrengthMg / waterVolumeMl;
  const drawVolumeMl = desiredDoseMcg / concentrationMcgPerMl;
  const syringeUnits = Math.round(drawVolumeMl * 100 * 10) / 10; // round to 0.1
  const dosesPerVial = Math.floor(totalMcg / desiredDoseMcg);

  return {
    desiredDoseMcg,
    vialStrengthMg,
    waterVolumeMl,
    concentrationMcgPerMl: Math.round(concentrationMcgPerMl * 10) / 10,
    concentrationMgPerMl: Math.round(concentrationMgPerMl * 100) / 100,
    drawVolumeMl: Math.round(drawVolumeMl * 1000) / 1000,
    syringeUnits,
    dosesPerVial,
  };
}

/**
 * Convert mg to mcg
 */
export function mgToMcg(mg: number): number {
  return mg * 1000;
}

/**
 * Convert mcg to mg
 */
export function mcgToMg(mcg: number): number {
  return mcg / 1000;
}

/**
 * Format mcg for display — show as mg if >= 1000
 */
export function formatDose(mcg: number): string {
  if (mcg >= 1000) {
    const mg = mcg / 1000;
    return `${mg % 1 === 0 ? mg : mg.toFixed(1)} mg`;
  }
  return `${mcg % 1 === 0 ? mcg : mcg.toFixed(1)} mcg`;
}

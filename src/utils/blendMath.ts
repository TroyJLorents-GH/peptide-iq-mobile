import type { Compound, UserStack, UserStackComponent } from '../types';
import { getCompoundById } from '../data/compounds';

export interface AggregatePK {
  halfLifeHours: number;
  tmaxHours: number;
  bioavailability: number;
  steadyStateDays: number;
  doseFrequencyHours: number;
  accumulationFactor: number | null;
}

/**
 * Compute aggregate PK for a custom blend from its components.
 *
 * Approach (transparent and defensible):
 * - Half-life: max of components (slowest component dominates effective decay tail)
 * - Tmax: max of components (rate-limiting peak)
 * - Bioavailability: mass-weighted average across components
 * - Steady state days: derived from effective half-life (~5 half-lives)
 * - Dose frequency: max of components (least-frequent component sets cycle)
 *
 * Components without library data are skipped from the math.
 */
export function computeAggregatePK(
  components: UserStackComponent[]
): AggregatePK {
  const withData = components
    .map(c => ({ comp: c, src: getCompoundById(c.compoundId) }))
    .filter(x => !!x.src) as { comp: UserStackComponent; src: Compound }[];

  if (withData.length === 0) {
    return {
      halfLifeHours: 0,
      tmaxHours: 0,
      bioavailability: 0,
      steadyStateDays: 0,
      doseFrequencyHours: 24,
      accumulationFactor: null,
    };
  }

  const totalMg = withData.reduce((s, x) => s + x.comp.mgPerVial, 0) || 1;

  const halfLifeHours = Math.max(...withData.map(x => x.src.pk.halfLifeHours));
  const tmaxHours = Math.max(...withData.map(x => x.src.pk.tmaxHours));
  const bioavailability =
    withData.reduce((s, x) => s + x.src.pk.bioavailability * x.comp.mgPerVial, 0) / totalMg;
  const doseFrequencyHours = Math.max(...withData.map(x => x.src.pk.doseFrequencyHours));
  const steadyStateDays = Math.max(1, Math.ceil((halfLifeHours * 5) / 24));

  return {
    halfLifeHours: Math.round(halfLifeHours * 10) / 10,
    tmaxHours: Math.round(tmaxHours * 10) / 10,
    bioavailability: Math.round(bioavailability * 100) / 100,
    steadyStateDays,
    doseFrequencyHours,
    accumulationFactor: null,
  };
}

/**
 * Merge component safety fields into a deduplicated aggregate set.
 */
export function aggregateSafety(components: UserStackComponent[]) {
  const sources = components
    .map(c => getCompoundById(c.compoundId))
    .filter((c): c is Compound => !!c);

  const dedupe = (arr: string[]) => Array.from(new Set(arr));

  return {
    contraindications: dedupe(sources.flatMap(s => s.safety.contraindications)),
    majorWarnings: dedupe(sources.flatMap(s => s.safety.majorWarnings)),
    commonSideEffects: dedupe(sources.flatMap(s => s.safety.commonSideEffects)),
    seriousSideEffects: dedupe(sources.flatMap(s => s.safety.seriousSideEffects)),
    interactionNotes: dedupe(sources.flatMap(s => s.safety.interactionNotes)),
  };
}

/**
 * Build a synthetic Compound from a UserStack so the rest of the app
 * (calculator, my peptides, etc.) can treat it identically.
 */
export function userStackToCompound(stack: UserStack): Compound {
  const pk = computeAggregatePK(stack.components);
  const safety = aggregateSafety(stack.components);
  const linkedSources = stack.components
    .map(c => getCompoundById(c.compoundId))
    .filter((c): c is Compound => !!c)
    .flatMap(c => c.sources);

  return {
    id: userStackCompoundId(stack.id),
    genericName: stack.name,
    brandNames: ['My Custom Blend'],
    category: 'blend',
    approvalStatus: 'experimental',
    evidenceTier: 'experimental',
    routes: ['subcutaneous', 'intramuscular'],
    description: `Your custom blend (${stack.totalMg} mg vial). Aggregate pharmacokinetics below are computed from each component's library data, weighted by your vial's exact mg ratio. Source data points to the underlying single peptides.`,
    pk: {
      halfLifeHours: pk.halfLifeHours,
      tmaxHours: pk.tmaxHours,
      bioavailability: pk.bioavailability,
      steadyStateDays: pk.steadyStateDays,
      doseFrequencyHours: pk.doseFrequencyHours,
      accumulationFactor: pk.accumulationFactor,
    },
    dosing: {
      standardStartDose: 'User-defined — calculate via syringe calculator',
      titrationSteps: [],
      maxDose: 'User-defined',
      missedDoseRules: 'Skip missed dose; do not double up.',
      reconstitutionSupported: true,
      fixedDevice: false,
      commonStrengthsMg: [stack.totalMg],
      commonWaterMl: [2, 3],
    },
    safety: {
      boxedWarning: null,
      contraindications: safety.contraindications,
      majorWarnings: [
        'Aggregate values computed from component data — see each component for source-grade values',
        'Multiple research peptides combined → additive risk vs. any single component',
        ...safety.majorWarnings,
      ],
      commonSideEffects: safety.commonSideEffects,
      seriousSideEffects: safety.seriousSideEffects,
      interactionNotes: safety.interactionNotes,
      foodEffectNotes: [],
      hydrationWarning: null,
      labMonitoringNotes: ['No established monitoring protocol for this blend'],
    },
    sources: linkedSources,
    blendVialTotalMg: stack.totalMg,
    blendComposition: stack.components.map(c => ({
      compoundId: c.compoundId,
      label: c.label,
      mgPerVial: c.mgPerVial,
      pctByMass: stack.totalMg > 0 ? c.mgPerVial / stack.totalMg : 0,
    })),
  };
}

const USER_STACK_PREFIX = 'userstack:';

export function userStackCompoundId(stackId: string): string {
  return `${USER_STACK_PREFIX}${stackId}`;
}

export function isUserStackCompoundId(id: string): boolean {
  return id.startsWith(USER_STACK_PREFIX);
}

export function parseUserStackCompoundId(id: string): string | null {
  return id.startsWith(USER_STACK_PREFIX) ? id.slice(USER_STACK_PREFIX.length) : null;
}

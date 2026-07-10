// ============================================================
// PeptideIQ — Core Types
// ============================================================

export type EvidenceTier =
  | 'fda-label'
  | 'clinical-trial'
  | 'peer-reviewed'
  | 'case-report'
  | 'experimental'
  | 'user-note';

export type ApprovalStatus = 'approved' | 'phase-3' | 'experimental' | 'non-peptide';

export type CompoundCategory =
  | 'glp-1'
  | 'ghrh'
  | 'growth-hormone'
  | 'melanocortin'
  | 'peptide-general'
  | 'neuropeptide'
  | 'hormone'
  | 'non-peptide'
  | 'blend';

export type Route = 'subcutaneous' | 'intramuscular' | 'intravenous' | 'intranasal' | 'topical' | 'oral';

export interface Compound {
  id: string;
  genericName: string;
  brandNames: string[];
  category: CompoundCategory;
  approvalStatus: ApprovalStatus;
  evidenceTier: EvidenceTier;
  routes: Route[];
  description: string;

  // PK profile
  pk: {
    halfLifeHours: number;
    tmaxHours: number;
    bioavailability: number; // 0–1
    steadyStateDays: number | null;
    doseFrequencyHours: number; // e.g., 168 for weekly
    accumulationFactor: number | null;
  };

  // Dosing
  dosing: {
    standardStartDose: string;
    titrationSteps: string[];
    maxDose: string;
    missedDoseRules: string;
    reconstitutionSupported: boolean;
    fixedDevice: boolean;
    commonStrengthsMg: number[];
    commonWaterMl: number[];
  };

  // Safety
  safety: {
    boxedWarning: string | null;
    contraindications: string[];
    majorWarnings: string[];
    commonSideEffects: string[];
    seriousSideEffects: string[];
    interactionNotes: string[];
    foodEffectNotes: string[];
    hydrationWarning: string | null;
    labMonitoringNotes: string[];
  };

  // Sources
  sources: {
    url: string;
    type: EvidenceTier;
    label: string;
  }[];

  // For category: 'blend' — component breakdown of the standard vial
  blendComposition?: {
    compoundId: string;     // links to another Compound.id
    label: string;          // display label (e.g., "GHK-Cu")
    mgPerVial: number;      // mg of this component in the standard vial
    pctByMass: number;      // 0–1, share of total vial mass
    notesPerComponent?: string;
  }[];

  // For category: 'blend' — total vial mass (sum of components)
  blendVialTotalMg?: number;
}

// User's active compound with their personal settings
export interface UserCompound {
  id: string;
  compoundId: string;
  startDate: string; // ISO date
  doseAmountMcg: number;
  doseFrequencyHours: number;
  route: Route;
  vialStrengthMg: number;
  waterVolumeMl: number;
  color: string; // chart line color
  active: boolean;
  plannedDurationDays?: number | null; // how long user plans to be on this peptide
  scheduledDaysOfWeek?: number[] | null; // 0=Sun..6=Sat. If set, scheduling uses these days
}

export interface UserVial {
  id: string;
  userId: string;
  userCompoundId: string;
  compoundId: string;
  vialStrengthMg: number;
  waterVolumeMl: number;
  openedAt: string;
  retiredAt?: string | null;
  active: boolean;
  notes: string;
  createdAt: string;
}

// Individual dose log entry
export interface DoseLog {
  id: string;
  userId: string;
  compoundId: string;
  userCompoundId: string;
  timestamp: string; // ISO datetime — when the dose was actually taken
  scheduledFor?: string | null; // ISO of the scheduled slot this dose satisfies (set when logged from the schedule); null for ad-hoc logs
  doseMcg: number;
  units: number; // syringe units drawn
  route: Route;
  injectionSite: string;
  notes: string;
}

// Calculator result
export interface CalculatorResult {
  desiredDoseMcg: number;
  vialStrengthMg: number;
  waterVolumeMl: number;
  concentrationMcgPerMl: number;
  concentrationMgPerMl: number;
  drawVolumeMl: number;
  syringeUnits: number;
  dosesPerVial: number;
}

// Serum concentration data point
export interface SerumDataPoint {
  timestamp: number; // ms since epoch
  concentration: number; // estimated mcg/mL
  compoundId: string;
}

// User-defined custom stack (private to the user, not in main library)
export interface UserStackComponent {
  compoundId: string;   // matches a Compound.id from compounds.ts
  label: string;        // display label (snapshot of compound.genericName at create time)
  mgPerVial: number;    // mg of this component in the user's vial
}

export interface UserStack {
  id: string;
  userId: string;
  name: string;
  totalMg: number;
  components: UserStackComponent[];
  notes: string;
  createdAt: string;
}

// Alert triggered by serum levels / dosing
export interface Alert {
  id: string;
  compoundId: string;
  type: 'warning' | 'info' | 'caution' | 'critical';
  title: string;
  message: string;
  evidenceTier: EvidenceTier;
  sourceUrl: string;
  triggerCondition: string;
}

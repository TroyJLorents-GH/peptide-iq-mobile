import type { UserCompound, DoseLog } from '../types';

export interface PlannedDose {
  userCompoundId: string;
  compoundId: string;
  scheduledAt: number; // ms since epoch
  doseMcg: number;
  doseNumber: number; // 1-indexed within plan
  weekNumber: number; // weeks since startDate
  isOverdue: boolean;
  isToday: boolean;
  isTaken: boolean; // matched to a dose log
  matchedLogId?: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DEFAULT_HORIZON_DAYS = 90; // if no plannedDurationDays set, generate next 90d

/**
 * Generate ALL planned doses for a user compound across its planned duration.
 * Matches each planned slot to logged doses (same compound, scheduled time within ±frequency/2).
 */
export function generatePlannedDoses(
  uc: UserCompound,
  doseLogs: DoseLog[],
  now: number = Date.now()
): PlannedDose[] {
  if (!uc.active) return [];

  const freqMs = uc.doseFrequencyHours * HOUR_MS;
  if (freqMs <= 0) return [];

  const startMs = new Date(uc.startDate).getTime();
  if (isNaN(startMs)) return [];

  const planEndMs = uc.plannedDurationDays
    ? startMs + uc.plannedDurationDays * DAY_MS
    : Math.max(now, startMs) + DEFAULT_HORIZON_DAYS * DAY_MS;

  // Logged doses for this compound, sorted ascending
  const compoundDoses = doseLogs
    .filter(d => d.userCompoundId === uc.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Generate scheduled timestamps
  const useDayOfWeek = uc.scheduledDaysOfWeek && uc.scheduledDaysOfWeek.length > 0;
  const scheduledTimestamps: number[] = [];

  if (useDayOfWeek && uc.scheduledDaysOfWeek) {
    // Iterate day-by-day from startDate; emit a slot when day-of-week is in the set
    const startTimeOfDayMs =
      new Date(startMs).getHours() * HOUR_MS +
      new Date(startMs).getMinutes() * 60 * 1000;
    const startDayMidnight = new Date(startMs);
    startDayMidnight.setHours(0, 0, 0, 0);
    let cur = startDayMidnight.getTime();
    while (cur <= planEndMs && scheduledTimestamps.length < 1000) {
      const dow = new Date(cur).getDay();
      if (uc.scheduledDaysOfWeek.includes(dow)) {
        const slotMs = cur + startTimeOfDayMs;
        if (slotMs >= startMs && slotMs <= planEndMs) {
          scheduledTimestamps.push(slotMs);
        }
      }
      cur += DAY_MS;
    }
  } else {
    // Frequency-based
    let t = startMs;
    while (t <= planEndMs && scheduledTimestamps.length < 1000) {
      scheduledTimestamps.push(t);
      t += freqMs;
    }
  }

  const out: PlannedDose[] = [];
  const matchWindow = freqMs / 2;
  const usedLogIds = new Set<string>();

  for (let i = 0; i < scheduledTimestamps.length; i++) {
    const scheduledAt = scheduledTimestamps[i];
    const doseNumber = i + 1;
    let matched: DoseLog | undefined;

    // 1. Exact slot binding: a log explicitly recorded for this scheduled slot.
    //    Clears the slot no matter what clock time the user logged it at.
    for (const d of compoundDoses) {
      if (usedLogIds.has(d.id)) continue;
      if (d.scheduledFor && new Date(d.scheduledFor).getTime() === scheduledAt) {
        matched = d;
        break;
      }
    }
    // 2. Fallback for ad-hoc / legacy logs (no slot binding): timestamp proximity.
    //    Slot-bound logs are skipped here so they only ever satisfy their own slot.
    if (!matched) {
      for (const d of compoundDoses) {
        if (usedLogIds.has(d.id)) continue;
        if (d.scheduledFor) continue;
        const t = new Date(d.timestamp).getTime();
        if (Math.abs(t - scheduledAt) <= matchWindow) {
          matched = d;
          break;
        }
      }
    }
    if (matched) usedLogIds.add(matched.id);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = todayStart.getTime() + DAY_MS;

    out.push({
      userCompoundId: uc.id,
      compoundId: uc.compoundId,
      scheduledAt,
      doseMcg: uc.doseAmountMcg,
      doseNumber,
      weekNumber: Math.max(1, Math.floor((scheduledAt - startMs) / (7 * DAY_MS)) + 1),
      isOverdue: !matched && scheduledAt < now,
      isToday: scheduledAt >= todayStart.getTime() && scheduledAt < todayEnd,
      isTaken: !!matched,
      matchedLogId: matched?.id,
    });
  }

  return out;
}

/**
 * All planned doses across all active compounds, sorted by scheduledAt.
 */
export function generateAllPlannedDoses(
  userCompounds: UserCompound[],
  doseLogs: DoseLog[],
  now: number = Date.now()
): PlannedDose[] {
  return userCompounds
    .flatMap(uc => generatePlannedDoses(uc, doseLogs, now))
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
}

/**
 * Just the upcoming (not-yet-taken) planned doses.
 */
export function getUpcomingPlannedDoses(
  userCompounds: UserCompound[],
  doseLogs: DoseLog[],
  now: number = Date.now()
): PlannedDose[] {
  return generateAllPlannedDoses(userCompounds, doseLogs, now)
    .filter(d => !d.isTaken);
}

/**
 * Compute vial economics from compound config.
 */
export function calculateVialMath(uc: UserCompound) {
  if (uc.vialStrengthMg <= 0 || uc.doseAmountMcg <= 0) return null;
  const dosesPerVial = Math.floor((uc.vialStrengthMg * 1000) / uc.doseAmountMcg);
  if (dosesPerVial <= 0) return null;
  const daysPerDose = uc.doseFrequencyHours / 24;
  const daysPerVial = Math.round(dosesPerVial * daysPerDose);
  let vialsForPlan: number | null = null;
  if (uc.plannedDurationDays && uc.plannedDurationDays > 0) {
    const dosesNeeded = Math.ceil(uc.plannedDurationDays / daysPerDose);
    vialsForPlan = Math.ceil(dosesNeeded / dosesPerVial);
  }
  return {
    dosesPerVial,
    daysPerVial,
    vialsForPlan,
  };
}

/**
 * Format relative time until a scheduled dose.
 */
export function formatTimeUntil(scheduledAt: number, now: number = Date.now()): string {
  const diffMs = scheduledAt - now;
  if (diffMs < 0) {
    const overdueMs = Math.abs(diffMs);
    const hours = Math.floor(overdueMs / HOUR_MS);
    if (hours < 24) return `${hours}h overdue`;
    return `${Math.floor(hours / 24)}d overdue`;
  }
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `in ${days}d`;
  return `in ${Math.floor(days / 7)}w`;
}

// ─── Backwards-compat aliases ───
export type UpcomingDose = PlannedDose;

export function getNextDose(
  uc: UserCompound,
  doseLogs: DoseLog[],
  now: number = Date.now()
): PlannedDose | null {
  const upcoming = generatePlannedDoses(uc, doseLogs, now).filter(d => !d.isTaken && d.scheduledAt >= now - 60 * 60 * 1000);
  return upcoming[0] ?? null;
}

export function getUpcomingDoses(
  userCompounds: UserCompound[],
  doseLogs: DoseLog[],
  now: number = Date.now()
): PlannedDose[] {
  return getUpcomingPlannedDoses(userCompounds, doseLogs, now);
}

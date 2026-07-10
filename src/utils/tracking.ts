import type { DoseLog, UserCompound, UserVial } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getActiveVial(userCompoundId: string, vials: UserVial[]) {
  return vials
    .filter(v => v.userCompoundId === userCompoundId && v.active)
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())[0] ?? null;
}

export function vialRemainingMg(uc: UserCompound, logs: DoseLog[], vials: UserVial[]) {
  const activeVial = getActiveVial(uc.id, vials);
  const vialStrengthMg = activeVial?.vialStrengthMg ?? uc.vialStrengthMg;

  if (vialStrengthMg <= 0) {
    return {
      activeVial,
      remainingMg: null,
      usedMg: 0,
      vialStrengthMg: null,
      remainingPct: null,
      source: 'none' as const,
    };
  }

  const openedAtMs = activeVial ? new Date(activeVial.openedAt).getTime() : null;
  const retiredAtMs = activeVial?.retiredAt ? new Date(activeVial.retiredAt).getTime() : null;
  const relevantLogs = logs.filter(log => {
    const timestamp = new Date(log.timestamp).getTime();
    if (activeVial && log.userCompoundId !== activeVial.userCompoundId) return false;
    if (!activeVial && log.compoundId !== uc.compoundId) return false;
    if (openedAtMs !== null && timestamp < openedAtMs) return false;
    if (retiredAtMs !== null && timestamp > retiredAtMs) return false;
    return true;
  });
  const usedMg = relevantLogs.reduce((sum, d) => sum + d.doseMcg / 1000, 0);
  const remainingMg = Math.max(0, vialStrengthMg - usedMg);

  return {
    activeVial,
    remainingMg,
    usedMg,
    vialStrengthMg,
    remainingPct: Math.max(0, Math.min(100, (remainingMg / vialStrengthMg) * 100)),
    source: activeVial ? 'vial' as const : 'legacy' as const,
  };
}

export function planProgress(uc: UserCompound) {
  if (!uc.plannedDurationDays || uc.plannedDurationDays <= 0) return null;
  const startMs = new Date(uc.startDate).getTime();
  if (!Number.isFinite(startMs)) return null;
  const endMs = startMs + uc.plannedDurationDays * DAY_MS;
  const remainingDays = Math.max(0, Math.ceil((endMs - Date.now()) / DAY_MS));
  const elapsedDays = Math.max(0, Math.floor((Date.now() - startMs) / DAY_MS));

  return {
    totalDays: uc.plannedDurationDays,
    totalWeeks: uc.plannedDurationDays / 7,
    elapsedDays,
    remainingDays,
    remainingWeeks: remainingDays / 7,
    endDate: new Date(endMs),
    isComplete: remainingDays <= 0,
  };
}

export function formatWeeks(value: number) {
  if (value <= 0) return '0 weeks';
  return `${value.toFixed(value >= 10 ? 0 : 1)} weeks`;
}

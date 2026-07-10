import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import * as Crypto from 'expo-crypto';
const uuidv4 = () => Crypto.randomUUID();
import type { UserCompound, DoseLog, UserStack, UserVial, Compound } from '../types';
import { nextFreeColor } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { getCompoundById } from '../data/compounds';
import { userStackToCompound, isUserStackCompoundId } from '../utils/blendMath';

interface AppContextType {
  userCompounds: UserCompound[];
  doseLogs: DoseLog[];
  userStacks: UserStack[];
  userVials: UserVial[];
  loading: boolean;
  addUserCompound: (compound: Omit<UserCompound, 'id' | 'color'> & { color?: string }) => void;
  updateUserCompound: (id: string, updates: Partial<Omit<UserCompound, 'id'>>) => void;
  removeUserCompound: (id: string) => void;
  toggleCompoundActive: (id: string) => void;
  addDoseLog: (log: Omit<DoseLog, 'id' | 'userId'>) => void;
  updateDoseLog: (id: string, updates: Partial<Omit<DoseLog, 'id' | 'userId'>>) => void;
  removeDoseLog: (id: string) => void;
  startUserVial: (vial: Omit<UserVial, 'id' | 'userId' | 'active' | 'retiredAt' | 'createdAt'>) => Promise<UserVial | null>;
  updateUserVial: (id: string, updates: Partial<Omit<UserVial, 'id' | 'userId' | 'createdAt'>>) => Promise<boolean>;
  addUserStack: (stack: Omit<UserStack, 'id' | 'userId' | 'createdAt'>) => Promise<UserStack | null>;
  removeUserStack: (id: string) => void;
  /** Resolve any compoundId (curated or `userstack:<uuid>`) to a Compound. */
  resolveCompound: (compoundId: string) => Compound | undefined;
}

const AppContext = createContext<AppContextType | null>(null);

// Map DB row (snake_case) → app type (camelCase)
function rowToUserCompound(row: any): UserCompound {
  return {
    id: row.id,
    compoundId: row.compound_id,
    startDate: row.start_date,
    doseAmountMcg: row.dose_amount_mcg,
    doseFrequencyHours: row.dose_frequency_hours,
    route: row.route,
    vialStrengthMg: row.vial_strength_mg,
    waterVolumeMl: row.water_volume_ml,
    color: row.color,
    active: row.active,
    plannedDurationDays: row.planned_duration_days ?? null,
    scheduledDaysOfWeek: row.scheduled_days_of_week ?? null,
  };
}

function rowToUserStack(row: any): UserStack {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    totalMg: Number(row.total_mg) || 0,
    components: Array.isArray(row.components) ? row.components : [],
    notes: row.notes ?? '',
    createdAt: row.created_at,
  };
}

function rowToDoseLog(row: any): DoseLog {
  return {
    id: row.id,
    userId: row.user_id,
    compoundId: row.compound_id,
    userCompoundId: row.user_compound_id,
    timestamp: row.timestamp,
    scheduledFor: row.scheduled_for ?? null,
    doseMcg: row.dose_mcg,
    units: row.units,
    route: row.route,
    injectionSite: row.injection_site,
    notes: row.notes,
  };
}

function rowToUserVial(row: any): UserVial {
  return {
    id: row.id,
    userId: row.user_id,
    userCompoundId: row.user_compound_id,
    compoundId: row.compound_id,
    vialStrengthMg: Number(row.vial_strength_mg) || 0,
    waterVolumeMl: Number(row.water_volume_ml) || 0,
    openedAt: row.opened_at,
    retiredAt: row.retired_at ?? null,
    active: row.active,
    notes: row.notes ?? '',
    createdAt: row.created_at,
  };
}

// Backfill compounds that have no color. Duplicates are left alone — the
// ColorPicker lets users deliberately reuse a color, so their choice wins.
function fixMissingColors(compounds: UserCompound[]): UserCompound[] {
  const usedColors = compounds.filter(uc => uc.color).map(uc => uc.color);
  return compounds.map((uc, i) => {
    if (uc.color) return uc;
    const newColor = nextFreeColor(usedColors, i);
    usedColors.push(newColor);
    return { ...uc, color: newColor };
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userCompounds, setUserCompounds] = useState<UserCompound[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [userStacks, setUserStacks] = useState<UserStack[]>([]);
  const [userVials, setUserVials] = useState<UserVial[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data from Supabase when user is authenticated
  const loadData = useCallback(async () => {
    if (!user) {
      setUserCompounds([]);
      setDoseLogs([]);
      setUserStacks([]);
      setUserVials([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [compoundsRes, dosesRes, stacksRes, vialsRes] = await Promise.all([
      supabase
        .from('user_compounds')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('dose_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true }),
      supabase
        .from('user_stacks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('user_vials')
        .select('*')
        .eq('user_id', user.id)
        .order('opened_at', { ascending: true }),
    ]);

    if (compoundsRes.data) {
      setUserCompounds(fixMissingColors(compoundsRes.data.map(rowToUserCompound)));
    }
    if (dosesRes.data) {
      setDoseLogs(dosesRes.data.map(rowToDoseLog));
    }
    if (stacksRes.data) {
      setUserStacks(stacksRes.data.map(rowToUserStack));
    }
    if (vialsRes.data) {
      setUserVials(vialsRes.data.map(rowToUserVial));
    }
    // user_stacks table may not exist yet (pre-migration) — error is fine, just no stacks shown.

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addUserCompound = async (compound: Omit<UserCompound, 'id' | 'color'> & { color?: string }) => {
    if (!user) return;

    // Use the color the user picked in the Add dialog; fall back to the next free one.
    const color = compound.color || nextFreeColor(userCompounds.map(c => c.color));
    const id = uuidv4();

    // Optimistic update
    const newCompound: UserCompound = { ...compound, id, color };
    setUserCompounds(prev => [...prev, newCompound]);

    await supabase.from('user_compounds').insert({
      id,
      user_id: user.id,
      compound_id: compound.compoundId,
      start_date: compound.startDate,
      dose_amount_mcg: compound.doseAmountMcg,
      dose_frequency_hours: compound.doseFrequencyHours,
      route: compound.route,
      vial_strength_mg: compound.vialStrengthMg,
      water_volume_ml: compound.waterVolumeMl,
      color,
      active: compound.active,
      planned_duration_days: compound.plannedDurationDays ?? null,
      scheduled_days_of_week: compound.scheduledDaysOfWeek ?? null,
    });
  };

  const updateUserCompound = async (id: string, updates: Partial<Omit<UserCompound, 'id'>>) => {
    // Optimistic update
    setUserCompounds(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    const dbUpdates: Record<string, any> = {};
    if (updates.compoundId !== undefined) dbUpdates.compound_id = updates.compoundId;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.doseAmountMcg !== undefined) dbUpdates.dose_amount_mcg = updates.doseAmountMcg;
    if (updates.doseFrequencyHours !== undefined) dbUpdates.dose_frequency_hours = updates.doseFrequencyHours;
    if (updates.route !== undefined) dbUpdates.route = updates.route;
    if (updates.vialStrengthMg !== undefined) dbUpdates.vial_strength_mg = updates.vialStrengthMg;
    if (updates.waterVolumeMl !== undefined) dbUpdates.water_volume_ml = updates.waterVolumeMl;
    if (updates.active !== undefined) dbUpdates.active = updates.active;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.plannedDurationDays !== undefined) dbUpdates.planned_duration_days = updates.plannedDurationDays;
    if (updates.scheduledDaysOfWeek !== undefined) dbUpdates.scheduled_days_of_week = updates.scheduledDaysOfWeek;

    await supabase.from('user_compounds').update(dbUpdates).eq('id', id);
  };

  const removeUserCompound = async (id: string) => {
    setUserCompounds(prev => prev.filter(c => c.id !== id));
    setDoseLogs(prev => prev.filter(d => d.userCompoundId !== id));

    await Promise.all([
      supabase.from('dose_logs').delete().eq('user_compound_id', id),
      supabase.from('user_compounds').delete().eq('id', id),
    ]);
  };

  const toggleCompoundActive = async (id: string) => {
    const compound = userCompounds.find(c => c.id === id);
    if (!compound) return;
    const newActive = !compound.active;

    setUserCompounds(prev => prev.map(c => c.id === id ? { ...c, active: newActive } : c));
    await supabase.from('user_compounds').update({ active: newActive }).eq('id', id);
  };

  const addDoseLog = async (log: Omit<DoseLog, 'id' | 'userId'>) => {
    if (!user) return;

    const id = uuidv4();
    const newLog: DoseLog = { ...log, id, userId: user.id };
    setDoseLogs(prev => [...prev, newLog]);

    await supabase.from('dose_logs').insert({
      id,
      user_id: user.id,
      compound_id: log.compoundId,
      user_compound_id: log.userCompoundId,
      timestamp: log.timestamp,
      scheduled_for: log.scheduledFor ?? null,
      dose_mcg: log.doseMcg,
      units: log.units,
      route: log.route,
      injection_site: log.injectionSite,
      notes: log.notes,
    });
  };

  const updateDoseLog = async (id: string, updates: Partial<Omit<DoseLog, 'id' | 'userId'>>) => {
    setDoseLogs(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));

    const dbUpdates: Record<string, any> = {};
    if (updates.compoundId !== undefined) dbUpdates.compound_id = updates.compoundId;
    if (updates.userCompoundId !== undefined) dbUpdates.user_compound_id = updates.userCompoundId;
    if (updates.timestamp !== undefined) dbUpdates.timestamp = updates.timestamp;
    if (updates.scheduledFor !== undefined) dbUpdates.scheduled_for = updates.scheduledFor;
    if (updates.doseMcg !== undefined) dbUpdates.dose_mcg = updates.doseMcg;
    if (updates.units !== undefined) dbUpdates.units = updates.units;
    if (updates.route !== undefined) dbUpdates.route = updates.route;
    if (updates.injectionSite !== undefined) dbUpdates.injection_site = updates.injectionSite;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    await supabase.from('dose_logs').update(dbUpdates).eq('id', id);
  };

  const removeDoseLog = async (id: string) => {
    setDoseLogs(prev => prev.filter(d => d.id !== id));
    await supabase.from('dose_logs').delete().eq('id', id);
  };

  const startUserVial = async (
    vial: Omit<UserVial, 'id' | 'userId' | 'active' | 'retiredAt' | 'createdAt'>
  ): Promise<UserVial | null> => {
    if (!user) return null;
    const id = uuidv4();
    const now = new Date().toISOString();
    const priorActiveIds = userVials
      .filter(v => v.userCompoundId === vial.userCompoundId && v.active)
      .map(v => v.id);
    const created: UserVial = {
      ...vial,
      id,
      userId: user.id,
      active: true,
      retiredAt: null,
      createdAt: now,
    };

    setUserVials(prev => [
      ...prev.map(v => priorActiveIds.includes(v.id) ? { ...v, active: false, retiredAt: vial.openedAt } : v),
      created,
    ]);

    const retire = priorActiveIds.length > 0
      ? supabase.from('user_vials').update({ active: false, retired_at: vial.openedAt }).in('id', priorActiveIds)
      : Promise.resolve({ error: null });
    const insert = supabase.from('user_vials').insert({
      id,
      user_id: user.id,
      user_compound_id: vial.userCompoundId,
      compound_id: vial.compoundId,
      vial_strength_mg: vial.vialStrengthMg,
      water_volume_ml: vial.waterVolumeMl,
      opened_at: vial.openedAt,
      active: true,
      notes: vial.notes,
    });

    const [retireRes, insertRes] = await Promise.all([retire, insert]);
    if (retireRes.error || insertRes.error) {
      console.error('Failed to start vial:', retireRes.error || insertRes.error);
      loadData();
      return null;
    }
    return created;
  };

  const updateUserVial = async (
    id: string,
    updates: Partial<Omit<UserVial, 'id' | 'userId' | 'createdAt'>>
  ): Promise<boolean> => {
    setUserVials(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));

    const dbUpdates: Record<string, any> = {};
    if (updates.userCompoundId !== undefined) dbUpdates.user_compound_id = updates.userCompoundId;
    if (updates.compoundId !== undefined) dbUpdates.compound_id = updates.compoundId;
    if (updates.vialStrengthMg !== undefined) dbUpdates.vial_strength_mg = updates.vialStrengthMg;
    if (updates.waterVolumeMl !== undefined) dbUpdates.water_volume_ml = updates.waterVolumeMl;
    if (updates.openedAt !== undefined) dbUpdates.opened_at = updates.openedAt;
    if (updates.retiredAt !== undefined) dbUpdates.retired_at = updates.retiredAt;
    if (updates.active !== undefined) dbUpdates.active = updates.active;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    const { error } = await supabase.from('user_vials').update(dbUpdates).eq('id', id);
    if (error) {
      console.error('Failed to update vial:', error);
      loadData();
      return false;
    }
    return true;
  };

  const addUserStack = async (
    stack: Omit<UserStack, 'id' | 'userId' | 'createdAt'>
  ): Promise<UserStack | null> => {
    if (!user) return null;
    const id = uuidv4();
    const created: UserStack = {
      ...stack,
      id,
      userId: user.id,
      createdAt: new Date().toISOString(),
    };
    setUserStacks(prev => [...prev, created]);
    const { error } = await supabase.from('user_stacks').insert({
      id,
      user_id: user.id,
      name: stack.name,
      total_mg: stack.totalMg,
      components: stack.components,
      notes: stack.notes,
    });
    if (error) {
      // rollback optimistic update on failure
      setUserStacks(prev => prev.filter(s => s.id !== id));
      console.error('Failed to create user stack:', error);
      return null;
    }
    return created;
  };

  const removeUserStack = async (id: string) => {
    setUserStacks(prev => prev.filter(s => s.id !== id));
    await supabase.from('user_stacks').delete().eq('id', id);
  };

  // Build user-stack synthetic compounds once per userStacks change so identity
  // is stable across renders. Stops downstream memoization from getting busted
  // when DashboardPage / ProgressPage call resolveCompound on every render.
  const userStackCompoundMap = useMemo(() => {
    const map: Record<string, Compound> = {};
    for (const stack of userStacks) {
      const compound = userStackToCompound(stack);
      map[compound.id] = compound;
    }
    return map;
  }, [userStacks]);

  const resolveCompound = useCallback(
    (compoundId: string): Compound | undefined => {
      if (isUserStackCompoundId(compoundId)) {
        return userStackCompoundMap[compoundId];
      }
      return getCompoundById(compoundId);
    },
    [userStackCompoundMap]
  );

  return (
    <AppContext.Provider
      value={{
        userCompounds,
        doseLogs,
        userStacks,
        userVials,
        loading,
        addUserCompound,
        updateUserCompound,
        removeUserCompound,
        toggleCompoundActive,
        addDoseLog,
        updateDoseLog,
        removeDoseLog,
        startUserVial,
        updateUserVial,
        addUserStack,
        removeUserStack,
        resolveCompound,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

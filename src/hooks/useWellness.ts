import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export type WellnessKind = 'water' | 'protein' | 'fiber';

interface WellnessLog {
  id: string;
  kind: WellnessKind;
  amount: number;
  recorded_at: string;
}

export interface WellnessTargets {
  water: number; // oz
  protein: number; // g
  fiber: number; // g
}

export const DEFAULT_TARGETS: WellnessTargets = { water: 80, protein: 120, fiber: 30 };

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Today's water/protein/fiber intake with quick add/undo, plus per-user
 * targets stored on user_goals (shared with the web app).
 */
export function useWellness() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WellnessLog[]>([]);
  const [targets, setTargets] = useState<WellnessTargets>(DEFAULT_TARGETS);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('wellness_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('recorded_at', startOfToday())
      .order('recorded_at', { ascending: false })
      .then(({ data }) => {
        if (data) setLogs(data as WellnessLog[]);
      });
    supabase
      .from('user_goals')
      .select('water_target_oz, protein_target_g, fiber_target_g')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTargets({
            water: data.water_target_oz ?? DEFAULT_TARGETS.water,
            protein: data.protein_target_g ?? DEFAULT_TARGETS.protein,
            fiber: data.fiber_target_g ?? DEFAULT_TARGETS.fiber,
          });
        }
      });
  }, [user]);

  const totals: Record<WellnessKind, number> = { water: 0, protein: 0, fiber: 0 };
  for (const l of logs) totals[l.kind] += Number(l.amount);

  const add = useCallback(async (kind: WellnessKind, amount: number) => {
    if (!user || amount <= 0) return;
    const optimistic: WellnessLog = {
      id: `tmp-${Date.now()}`,
      kind,
      amount,
      recorded_at: new Date().toISOString(),
    };
    setLogs(prev => [optimistic, ...prev]);
    const { data, error } = await supabase
      .from('wellness_logs')
      .insert({ user_id: user.id, kind, amount })
      .select()
      .single();
    setLogs(prev =>
      error
        ? prev.filter(l => l.id !== optimistic.id)
        : prev.map(l => (l.id === optimistic.id ? (data as WellnessLog) : l)),
    );
  }, [user]);

  /** Undo: removes the most recent entry of that kind today. */
  const removeLast = useCallback(async (kind: WellnessKind) => {
    if (!user) return;
    const last = logs.find(l => l.kind === kind);
    if (!last) return;
    setLogs(prev => prev.filter(l => l.id !== last.id));
    if (!last.id.startsWith('tmp-')) {
      await supabase.from('wellness_logs').delete().eq('id', last.id).eq('user_id', user.id);
    }
  }, [user, logs]);

  const saveTargets = useCallback(async (next: WellnessTargets) => {
    setTargets(next);
    if (!user) return;
    await supabase.from('user_goals').upsert(
      {
        user_id: user.id,
        water_target_oz: next.water,
        protein_target_g: next.protein,
        fiber_target_g: next.fiber,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  }, [user]);

  return { totals, targets, add, removeLast, saveTargets };
}

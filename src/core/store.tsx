import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as backend from './backend';
import type { Command, Snapshot } from './types';

type Store = {
  snapshot: Snapshot | null;
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
  run(command: Command): Promise<Snapshot>;
  clearError(): void;
};
const Context = createContext<Store | null>(null);
export function HabitsProvider({ children }: React.PropsWithChildren) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentDate = useRef<string | null>(null);
  const accept = useCallback((next: Snapshot) => {
    currentDate.current = next.date;
    setSnapshot(next);
  }, []);
  // Serialize UI commands; never allow an older async response to overwrite a newer one.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(work, work);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);
  const refresh = useCallback(async () => {
    await enqueue(async () => {
      try { accept(await backend.getSnapshot()); setError(null); }
      catch (e) { setError(e instanceof Error ? e.message : 'Could not read your habits.'); }
      finally { setLoading(false); }
    });
  }, [enqueue, accept]);
  const run = useCallback((command: Command) => enqueue(async () => {
    try {
      const next = await backend.execute(command);
      accept(next); setError(null);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      throw e;
    }
  }), [enqueue, accept]);
  useEffect(() => {
    void refresh();
    const native = backend.subscribe(accept);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    // Reconcile midnight even when someone leaves Today open overnight.
    const timer = setInterval(() => {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (AppState.currentState === 'active' && localDate !== currentDate.current) void refresh();
    }, 15_000);
    return () => { native.remove(); foreground.remove(); clearInterval(timer); };
  }, [refresh, accept]);
  return <Context.Provider value={{ snapshot, loading, error, refresh, run, clearError: () => setError(null) }}>{children}</Context.Provider>;
}
export function useHabits(): Store {
  const value = useContext(Context);
  if (!value) throw new Error('useHabits must be inside HabitsProvider');
  return value;
}

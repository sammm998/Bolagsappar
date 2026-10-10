// Backend, inloggning och valt konto. Data hämtas med useLoad och laddas om när backenden säger att något ändrats.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface Acc { role: string; forare_id: string | null; tenant: any; parent: any | null }
interface Ctx { b: any; user: any; accounts: Acc[]; acc: Acc | null; setAcc: (a: Acc) => void; refresh: () => Promise<void>; demo: boolean }
export const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);
export const useAcc = () => useContext(AppCtx).acc!;

export function useLoad<T = any>(fn: (b: any) => Promise<unknown>, deps: unknown[]): { data: T | undefined; loading: boolean; error: any; reload: () => void } {
  const { b } = useApp();
  const [s, set] = useState<{ data: T | undefined; loading: boolean; error: any }>({ data: undefined, loading: true, error: null });
  const [n, setN] = useState(0);
  const reload = useCallback(() => setN(x => x + 1), []);
  useEffect(() => b.subscribe(() => setN(x => x + 1)), [b]);
  useEffect(() => {
    let live = true;
    fn(b).then(data => live && set({ data: data as T, loading: false, error: null }), error => live && set({ data: undefined, loading: false, error }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, n, ...deps]);
  return { ...s, reload };
}

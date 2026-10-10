import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBackend } from './backend';

export interface Account { role: string; forare_id: string | null; tenant: any; parent: any | null }
interface S { user: any | null; accounts: Account[]; loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> }
const Ctx = createContext<S>({ user: null, accounts: [], loading: true, refresh: async () => {}, signOut: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const b = useBackend(); const qc = useQueryClient();
  const [state, set] = useState<{ user: any; accounts: Account[]; loading: boolean }>({ user: null, accounts: [], loading: true });
  const refresh = useCallback(async () => {
    const user = await b.getUser();
    const accounts = user ? await b.myAccounts() : [];
    set({ user, accounts, loading: false });
  }, [b]);
  useEffect(() => { refresh(); return b.onAuthChange(() => { qc.clear(); refresh(); }); }, [b, refresh, qc]);
  const signOut = useCallback(async () => { await b.signOut(); qc.clear(); await refresh(); }, [b, qc, refresh]);
  const v = useMemo(() => ({ ...state, refresh, signOut }), [state, refresh, signOut]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export const useSession = () => useContext(Ctx);

// ------------------------------------------------ aktivt konto
export const ROLLNAMN: Record<string, string> = { agare: 'Ägare', admin: 'Admin', ekonomi: 'Ekonomi', forare: 'Förare', las: 'Läs' };
export const TYPNAMN: Record<string, string> = { platform: 'Superadmin', main: 'Huvudkund', sub: 'Åkare', direct: 'Direktkund' };
export const typText = (a: Account) => a.tenant.type === 'sub' ? (a.parent ? `${a.tenant.brand?.akarOrd === 'underleverantör' ? 'Underleverantör' : 'Åkare'} hos ${a.parent.name}` : 'Åkare') : TYPNAMN[a.tenant.type];

export interface AccountCtx extends Account { canWrite: boolean; isDriver: boolean; central: string }
const ACtx = createContext<AccountCtx | null>(null);
export const AccountProvider = ({ value, children }: { value: AccountCtx; children: ReactNode }) => <ACtx.Provider value={value}>{children}</ACtx.Provider>;
export function useAccount(): AccountCtx { const a = useContext(ACtx); if (!a) throw new Error('Inget konto'); return a; }
export function toAccountCtx(a: Account): AccountCtx {
  const central = a.tenant.type === 'main' ? (a.tenant.settings?.centralNamn || a.tenant.name) : a.parent ? (a.parent.name) : a.tenant.name;
  return { ...a, canWrite: ['agare', 'admin', 'ekonomi'].includes(a.role), isDriver: a.role === 'forare', central };
}

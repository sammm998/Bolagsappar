// Datalager mot backenden med TanStack Query. Nycklarna börjar med tabellnamnet så att
// ändringar från backenden (subscribe) kan invalidera rätt frågor.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useBackend } from './backend';

export function wireInvalidation(backend: any, qc: QueryClient) {
  return backend.subscribe((evt: { table: string }) => {
    if (evt.table === '*') { qc.invalidateQueries(); return; }
    qc.invalidateQueries({ predicate: q => q.queryKey[0] === evt.table || (evt.table === 'shares' && q.queryKey[0] === 'network') || (evt.table === 'licenses' && q.queryKey[0] === 'network') });
  });
}

const opt = { staleTime: 30_000 };
export function useDoc<T = any>(t?: string, m?: string, path?: string) {
  const b = useBackend();
  return useQuery<T | null>({ queryKey: ['documents', t, m, 'doc', path], queryFn: () => b.getDoc(t, m, path), enabled: !!(t && m && path), ...opt });
}
export function useDocs<T = any>(t?: string, m?: string, prefix = '') {
  const b = useBackend();
  return useQuery<{ path: string; id: string; data: T }[]>({ queryKey: ['documents', t, m, 'list', prefix], queryFn: () => b.listDocs(t, m, prefix), enabled: !!(t && m), ...opt });
}
export function usePeriods(t?: string, m?: string) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['periods', t, m], queryFn: () => b.listPeriods(t, m), enabled: !!(t && m), ...opt }); }
export function useSharesTo(t?: string, m?: string | null) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['shares', 'to', t, m], queryFn: () => b.sharesTo(t, m), enabled: !!t, ...opt }); }
export function useSharesFrom(t?: string, m?: string, p?: string | null) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['shares', 'from', t, m, p], queryFn: () => b.sharesFrom(t, m, p), enabled: !!(t && m), ...opt }); }
export function useFileRuns(t?: string, m?: string, p?: string | null) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['file_runs', t, m, p], queryFn: () => b.fileRuns(t, m, p), enabled: !!(t && m), ...opt }); }
export function useLicenses(t?: string) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['licenses', t], queryFn: () => b.licenses(t), enabled: !!t, ...opt }); }
export function useChildLicenses(t?: string) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['licenses', 'children', t], queryFn: () => b.childLicenses(t), enabled: !!t, ...opt }); }
export function useOffers(t?: string | null) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['offers', t], queryFn: () => b.offers(t), enabled: !!t, ...opt }); }
export function useNetwork(t?: string, m = 'avrakning', p: string | null = null) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['network', t, m, p], queryFn: () => b.networkOverview(t, m, p), enabled: !!t, ...opt }); }
export function useInvites(t?: string) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['invites', t], queryFn: () => b.invites(t), enabled: !!t, ...opt }); }
export function useGuide(t?: string, m?: string) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['guide_progress', 'me', t, m], queryFn: () => b.guideProgress(t, m), enabled: !!(t && m), ...opt }); }
export function useAccountGuide(t?: string, m?: string) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['guide_progress', 'konto', t, m], queryFn: () => b.accountProgress(t, m), enabled: !!(t && m), ...opt }); }
export function useNotifications(t?: string) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['notifications', t], queryFn: () => b.notifications(t), enabled: !!t, ...opt }); }
export function useMembers(t?: string) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['memberships', t], queryFn: () => b.members(t), enabled: !!t, ...opt }); }
export function useAudit(t?: string) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['audit_log', t], queryFn: () => b.auditLog(t), enabled: !!t, ...opt }); }
export function useSupport(t?: string) { const b = useBackend(); return useQuery<any[]>({ queryKey: ['support_access', t], queryFn: () => b.supportAccess(t), enabled: !!t, ...opt }); }

/** Spara ett dokument och invalidera. */
export function useSaveDoc(t?: string, m?: string) {
  const b = useBackend(); const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, data, merge }: { path: string; data: any; merge?: boolean }) => b.setDoc(t, m, path, data, { merge }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', t, m] })
  });
}

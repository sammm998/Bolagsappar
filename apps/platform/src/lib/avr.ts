// Gemensamma hooks för Avräkning. Allt räknas i packages/core, skärmarna visar bara resultatet.
import { useMemo } from 'react';
import * as A from '@bolagsappar/core/avrakning';
import { filerFor } from '@bolagsappar/core/filetypes';
import { ymAdd } from '@bolagsappar/core/format';
import { useDoc, useDocs, usePeriods, useFileRuns } from './q';

export const M = 'avrakning';
export const UPLOADS = filerFor('avrakning').filter(f => f.key !== 'bilreg');

/** Inställningar i samma form som S i prototypen. */
export function useSettings(t?: string) {
  const q = useDocs(t, M, 'settings');
  const S = useMemo(() => {
    if (!q.data) return null;
    const by = Object.fromEntries(q.data.map(d => [d.id, d.data]));
    return {
      params: { ...A.DEFAULT_PARAMS, ...(by.params || {}) },
      bilar: by.bilar?.list || [], bolag: by.bolag?.list || [],
      terminaler: by.terminaler?.terminaler || [], kassor: by.terminaler?.kassor || [],
      fMap: by.forskottMap?.map || {}
    };
  }, [q.data]);
  return { S, loading: q.isLoading, error: q.error };
}

/** Alla sparade månader (months/<period>). */
export function useMonths(t?: string) {
  const q = useDocs(t, M, 'months');
  const months = useMemo(() => Object.fromEntries((q.data || []).map(d => [d.id, d.data])), [q.data]);
  return { months, loading: q.isLoading };
}

/** Månaden man jobbar med: senaste som inte är publicerad, annars månaden efter den senast publicerade. */
export function useWorkingPeriod(t?: string) {
  const p = usePeriods(t, M);
  return useMemo(() => {
    if (!p.data) return null;
    const open = p.data.filter(x => x.status !== 'publicerad').sort((a, b) => b.period.localeCompare(a.period))[0];
    if (open) return open.period;
    const pub = p.data.filter(x => x.status === 'publicerad').sort((a, b) => b.period.localeCompare(a.period))[0];
    if (pub) return ymAdd(pub.period, 1);
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7);
  }, [p.data]);
}
export function useLastPublished(t?: string) {
  const p = usePeriods(t, M);
  return useMemo(() => (p.data || []).filter(x => x.status === 'publicerad').sort((a, b) => b.period.localeCompare(a.period))[0] || null, [p.data]);
}

/** Vilka av månadens filer som är inlästa. */
export function useFileStatus(t?: string, period?: string | null) {
  const runs = useFileRuns(t, M, period || undefined);
  return useMemo(() => {
    const L = runs.data || [];
    const have = new Set(L.map(r => r.kind));
    const rows = UPLOADS.map(u => ({ ...u, run: L.find(r => r.kind === u.key) || null, have: have.has(u.key) }));
    return { rows, done: rows.filter(r => r.have).length, total: rows.length, missing: rows.filter(r => !r.have), requiredMissing: rows.filter(r => r.kravs && !r.have), loading: runs.isLoading };
  }, [runs.data, runs.isLoading]);
}

export function useMonthDoc(t?: string, period?: string | null) { return useDoc(t, M, period ? 'months/' + period : undefined); }

/** Kort namn på filen för "6 av 8 filer, X och Y saknas". */
export const kortNamn = (key: string) => ({ tc: 'TaxiCaller', bamb: 'Bambora', app: 'appbetalningarna', bro: 'bron', sturup: 'Sturup', resk: 'kundreskontran', bank: 'kontoutdraget', visma: 'Visma-facit' } as Record<string, string>)[key] || key;
export const listText = (L: string[]) => L.length <= 1 ? (L[0] || '') : L.slice(0, -1).join(', ') + ' och ' + L[L.length - 1];

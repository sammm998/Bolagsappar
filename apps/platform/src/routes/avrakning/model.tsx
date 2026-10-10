// En månad i Avräkning. Läser sparad data, känner igen nya filer, räknar om med packages/core och sparar.
// Exempelläget använder samma flöde men allt ligger i minnet och inget sparas.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as A from '@bolagsappar/core/avrakning';
import { ENG } from '@bolagsappar/core/kassan';
import { rawLines, HJALPTEXT } from '@bolagsappar/core/filetypes';
import { taxiMalmoSettings, genMonth, taxiCallerCsv, appCsv, oresundPages, sturupPages, bankRows } from '@bolagsappar/core/testdata';
import { readText } from '@bolagsappar/core/filetypes';
import { manadAr } from '@bolagsappar/core/format';
import { useBackend } from '../../lib/backend';
import { useAccount } from '../../lib/session';
import { useDoc, useFileRuns, usePeriods } from '../../lib/q';
import { useMonths, useSettings, M } from '../../lib/avr';
import { readLocal } from '../../lib/files';

export interface Pending { file: File | null; name: string; rec: any; read: any; period: string | null; status: 'ok' | 'felManad' | 'dubblett' | 'okand' | 'fel' | 'bank' | 'ofullstandig'; message: string; summary?: string; replaceRunId?: string }

export interface MonthModel {
  period: string; exempel: boolean; loading: boolean;
  S: any; D: any; R: any; months: Record<string, any>; prevSummary: any;
  status: 'oppen' | 'godkand' | 'publicerad'; version: number; periodRow: any;
  runs: any[]; marks: Record<string, boolean>;
  avvikelser: any[];
  locked: boolean;
  analyze: (files: File[]) => Promise<Pending[]>;
  commit: (list: Pending[]) => Promise<string[]>;
  saveManuellt: (bolag: string, patch: any) => Promise<void>;
  saveForskott: (forskottRad: any[], fMap: any) => Promise<void>;
  setSkuldMed: (v: boolean) => Promise<void>;
  mark: (key: string, v: boolean) => Promise<void>;
  passager: { bro: any[]; stu: any[] } | null;
  spec: any;
}

const Ctx = createContext<MonthModel | null>(null);
export const useMonth = () => { const m = useContext(Ctx); if (!m) throw new Error('Ingen månad'); return m; };
export const MonthProvider = ({ value, children }: { value: MonthModel; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;

const clone = (x: any) => x == null ? x : JSON.parse(JSON.stringify(x));
const devKey = (k: any) => [k.typ, k.vad].join('|');
export { devKey };

export function useMonthModel(period: string, exempel: boolean): MonthModel {
  const a = useAccount(); const t = a.tenant.id; const b = useBackend(); const qc = useQueryClient();
  const { S: S0 } = useSettings(exempel ? undefined : t);
  const { months: months0 } = useMonths(exempel ? undefined : t);
  const specDoc = useDoc<any>(exempel ? undefined : t, M, 'spec/' + period);
  const forDoc = useDoc<any>(exempel ? undefined : t, M, 'forare/' + period);
  const appDoc = useDoc<any>(exempel ? undefined : t, M, 'appspec/' + period);
  const pasDoc = useDoc<any>(exempel ? undefined : t, M, 'passager/' + period);
  const markDoc = useDoc<any>(exempel ? undefined : t, M, 'kontroll/' + period);
  const periods = usePeriods(exempel ? undefined : t, M);
  const runsQ = useFileRuns(exempel ? undefined : t, M, period);

  // Exempelläget: påhittad månad i minnet
  const [mem, setMem] = useState<any>(null);
  useEffect(() => {
    if (!exempel) { setMem(null); return; }
    const S = taxiMalmoSettings(); const Mx = genMonth(S, period, 4242);
    let D = A.emptyMonth(period); const runs: any[] = [];
    for (const [k, n, r] of [['tc', 'exempel_taxicaller.csv', readText('x.csv', taxiCallerCsv(Mx))], ['bamb', 'exempel_bambora.xlsx', { kind: 'sheet', sheets: { Sales: Mx.bamb } }], ['app', 'exempel_app.csv', readText('x.csv', appCsv(Mx))], ['bro', 'exempel_oresundsbro.pdf', { kind: 'pdf', pages: oresundPages(Mx) }], ['sturup', 'exempel_sturup.pdf', { kind: 'pdf', pages: sturupPages(Mx) }]] as any[]) {
      const res = A.applyFile(D, S, A.recognize(r, {}), n); D = res.D; runs.push({ id: k, kind: k, filename: n, summary: { text: res.summary }, created_at: new Date().toISOString() });
    }
    const bank = A.parseBankRows(bankRows(S, period));
    const sugg = A.suggestForskott(bank, S, D, {}); const [f, tt] = A.defaultRange(period);
    D.forskottRad = A.saveForskott(sugg, f, tt, {}).forskottRad; runs.push({ id: 'bank', kind: 'bank', filename: 'exempel_kontoutdrag.xlsx', summary: { text: D.forskottRad.length + ' förskott' } });
    const passager = { bro: ENG.parseBro(A.pagesLines(oresundPages(Mx))).rows, stu: ENG.parseSturup(A.pagesLines(sturupPages(Mx))).rows };
    setMem({ S, D, runs, marks: {}, passager, status: 'oppen' });
  }, [exempel, period]);

  const S = exempel ? mem?.S : S0;
  const months = exempel ? {} : months0;
  const monthDoc = months[period];
  const D = useMemo(() => {
    if (exempel) return mem?.D || null;
    if (!S || specDoc.isLoading || forDoc.isLoading || appDoc.isLoading) return null;
    const spec = specDoc.data ? clone(specDoc.data) : null;
    if (spec && forDoc.data) A.applyForare(spec.kund, forDoc.data);
    const D = A.restoreMonth(period, monthDoc, spec);
    if (appDoc.data) D.appRad = A.unpackApp(appDoc.data).map((x: any) => ({ id: x.id, bil: x.bil, datum: (x.d + ' ' + x.t).trim(), belopp: x.s, forare: x.f, fran: x.fran, till: x.till }));
    return D;
  }, [exempel, mem, S, monthDoc, specDoc.data, forDoc.data, appDoc.data, specDoc.isLoading, forDoc.isLoading, appDoc.isLoading, period]);
  const R = useMemo(() => (S && D ? A.computeMonth(S, D, months) : null), [S, D, months]);
  const prevSummary = useMemo(() => A.prevSummaryFor(period, months), [period, months]);
  const avvikelser = useMemo(() => (R ? A.avvikelser(R, prevSummary) : []), [R, prevSummary]);
  const periodRow = (periods.data || []).find(x => x.period === period) || null;
  const status = exempel ? 'oppen' : (periodRow?.status || 'oppen');
  const runs = exempel ? (mem?.runs || []) : (runsQ.data || []);
  const marks = exempel ? (mem?.marks || {}) : (markDoc.data?.done || {});
  const passager = exempel ? mem?.passager : (pasDoc.data || null);
  const locked = status !== 'oppen';

  const persist = useCallback(async (D2: any, extra: { tc?: boolean; app?: boolean; passager?: any } = {}) => {
    if (exempel) { setMem((m: any) => ({ ...m, D: D2, ...(extra.passager ? { passager: { ...(m.passager || {}), ...extra.passager } } : {}) })); return; }
    const R2 = A.computeMonth(S, D2, months);
    await b.setDoc(t, M, 'months/' + period, { ...A.monthBody(D2), summary: A.monthSummary(R2), files: D2.files, updatedAt: new Date().toISOString() });
    if (extra.tc && R2) { await b.setDoc(t, M, 'spec/' + period, A.packSpec(R2)); await b.setDoc(t, M, 'forare/' + period, A.packForare(R2.kund)); }
    if (extra.app && D2.appRad) await b.setDoc(t, M, 'appspec/' + period, A.packApp(D2.appRad));
    if (extra.passager) await b.setDoc(t, M, 'passager/' + period, { ...(passager || {}), ...extra.passager }, {});
    if (!periodRow) { try { await b.log(t, 'ny månad', M + ':' + period); } catch {} }
    qc.invalidateQueries({ queryKey: ['documents', t, M] });
  }, [exempel, S, months, b, t, period, passager, periodRow, qc]);

  const analyze = useCallback(async (files: File[]): Promise<Pending[]> => {
    const out: Pending[] = [];
    for (const file of files) {
      try {
        const read = await readLocal(file);
        const rec = A.recognize(read, { months });
        const fp = A.periodOf(rec, S);
        const dup = (exempel ? [] : runs).find((r: any) => r.sha256 && r.sha256 === read.sha256);
        if (rec.type === 'unknown') out.push({ file, name: file.name, rec, read, period: null, status: 'okand', message: HJALPTEXT.okand(rec.hint) });
        else if (rec.type === 'error') out.push({ file, name: file.name, rec, read, period: null, status: 'fel', message: rec.message });
        else if (rec.type === 'bank') out.push({ file, name: file.name, rec, read, period, status: 'bank', message: `${rec.rows.length} transaktioner. Du väljer förskotten i nästa steg.`, summary: `${rec.rows.length} transaktioner` });
        else if (fp && fp !== period) out.push({ file, name: file.name, rec, read, period: fp, status: 'felManad', message: HJALPTEXT.felManad(fp, period) });
        else if (dup) out.push({ file, name: file.name, rec, read, period: fp, status: 'dubblett', message: HJALPTEXT.dubblett(String(dup.created_at).slice(0, 10)), replaceRunId: dup.id });
        else if (rec.incomplete) out.push({ file, name: file.name, rec, read, period: fp, status: 'ofullstandig', message: HJALPTEXT.ofullstandig(rec.incomplete.missing, rec.incomplete.total, 'Øresundsbro') });
        else {
          const res = A.applyFile(D || A.emptyMonth(period), S, rec, file.name);
          if (res.error) out.push({ file, name: file.name, rec, read, period: fp, status: 'fel', message: res.error });
          else out.push({ file, name: file.name, rec, read, period: fp || period, status: 'ok', message: '', summary: res.summary + (fp ? ', ' + manadAr(fp).toLowerCase() : '') });
        }
      } catch (e: any) {
        out.push({ file, name: file.name, rec: null, read: null, period: null, status: 'fel', message: `Kunde inte läsa ${file.name}. Är filen färdigsparad? (${String(e?.message || e).slice(0, 120)})` });
      }
    }
    return out;
  }, [months, S, runs, exempel, period, D]);

  /** Spara de filer användaren har bekräftat. Returnerar meddelanden. */
  const commit = useCallback(async (list: Pending[]) => {
    let D2 = clone(D) || A.emptyMonth(period); const msgs: string[] = [];
    const extra: { tc?: boolean; app?: boolean; passager?: any } = {};
    for (const p of list) {
      if (!(p.status === 'ok' || p.status === 'dubblett' || p.status === 'ofullstandig')) continue;
      const res = A.applyFile(D2, S, p.rec, p.name);
      if (res.error) { msgs.push(res.error); continue; }
      // Spara inte trips-objektets Date osv, applyFile ger ren data
      D2 = res.D;
      if (p.rec.type === 'tc') extra.tc = true;
      if (p.rec.type === 'app') extra.app = true;
      if (p.rec.type === 'bro' && p.read?.rawPages) extra.passager = { ...(extra.passager || {}), bro: ENG.parseBro(rawLines(p.read.rawPages)).rows.map(({ t: _t, ...x }: any) => x) };
      if (p.rec.type === 'sturup' && p.read?.rawPages) extra.passager = { ...(extra.passager || {}), stu: ENG.parseSturup(rawLines(p.read.rawPages)).rows.map(({ t: _t, ...x }: any) => x) };
      if (res.paramsChange && !exempel) { await b.setDoc(t, M, 'settings/params', { ...S.params, ...res.paramsChange }); msgs.push(`Brons pris är ändrat till ${res.paramsChange.bro} kr enligt fakturan.`); }
      if (!exempel) {
        if (p.replaceRunId) await b.deleteFileRun(p.replaceRunId);
        await b.addFileRun({ tenant_id: t, module_key: M, period, kind: res.slot, filename: p.name, sha256: p.read?.sha256 || '', summary: { text: res.summary } });
      } else setMem((m: any) => ({ ...m, runs: [...(m.runs || []).filter((r: any) => r.kind !== res.slot), { id: res.slot, kind: res.slot, filename: p.name, summary: { text: res.summary }, created_at: new Date().toISOString() }] }));
    }
    await persist(D2, extra);
    return msgs;
  }, [D, period, S, b, t, persist, exempel]);

  const saveManuellt = useCallback(async (bolag: string, patch: any) => {
    const D2 = clone(D); D2.manuellt = { ...(D2.manuellt || {}), [bolag]: { ...(D2.manuellt?.[bolag] || {}), ...patch } };
    await persist(D2);
  }, [D, persist]);
  const saveForskott = useCallback(async (forskottRad: any[], fMap: any) => {
    const D2 = clone(D); D2.forskottRad = forskottRad;
    if (!exempel) {
      await b.setDoc(t, M, 'settings/forskottMap', { map: fMap });
      if (!runs.some((r: any) => r.kind === 'bank')) await b.addFileRun({ tenant_id: t, module_key: M, period, kind: 'bank', filename: 'Kontoutdrag', sha256: '', summary: { text: forskottRad.length + ' förskott' } });
    }
    await persist(D2);
  }, [D, persist, exempel, b, t, period, runs]);
  const setSkuldMed = useCallback(async (v: boolean) => { const D2 = clone(D); D2.skuldMed = v; await persist(D2); }, [D, persist]);
  const mark = useCallback(async (key: string, v: boolean) => {
    if (exempel) { setMem((m: any) => ({ ...m, marks: { ...m.marks, [key]: v } })); return; }
    await b.setDoc(t, M, 'kontroll/' + period, { done: { ...marks, [key]: v } });
  }, [exempel, b, t, period, marks]);

  const spec = useMemo(() => (R && D && S ? A.specForLive(R, S, D) : null), [R, D, S]);
  return {
    period, exempel, loading: !S || !D, S, D, R, months, prevSummary, status, version: periodRow?.version || 1, periodRow, runs, marks, avvikelser, locked,
    analyze, commit, saveManuellt, saveForskott, setSkuldMed, mark, passager, spec
  };
}

// Åkarkassans månad. Det centralen publicerat kommer automatiskt (avräkning, bro, Sturup).
// Åkaren lägger bara till LDL från Megtax. All beräkning sker i packages/core (ENG och lonespec).
import { useMemo } from 'react';
import { ENG, createEngine, computeInput, lonespec, hydrateShifts, fromShare, unpackP, utbDatum, utbMan } from '@bolagsappar/core/kassan';
import { ldlText } from '@bolagsappar/core/testdata';
import { useAccount } from '../../lib/session';
import { useDoc, useSharesTo } from '../../lib/q';

export const KM = 'kassan';

export function useKassa(period: string, exempel = false) {
  const a = useAccount(); const t = a.tenant.id;
  const settingsQ = useDoc<any>(t, KM, 'settings');
  const skattQ = useDoc<any>(t, KM, 'skatt');
  const monthQ = useDoc<any>(t, KM, 'm-' + period);
  const sharesQ = useSharesTo(t, 'avrakning');
  const variant = settingsQ.data?.variant === 'tripkassan' ? 'tripkassan' : 'akarkassan';
  const E = useMemo(() => (variant === 'tripkassan' ? createEngine('tripkassan') : ENG), [variant]);
  const share = (sharesQ.data || []).find(s => s.period === period) || null;
  const settings = useMemo(() => {
    const s = settingsQ.data || { foretag: a.tenant.name, cfg: {}, forare: {}, bilar: {} };
    if (!exempel) return s;
    return { ...s, forare: { '100001': { namn: 'Exempel Förare A', modell: 'procent', person: { personnr: '19900101-0000', tabell: 33, bank: 'x' } }, '100002': { namn: 'Exempel Förare B', modell: 'procent', person: { personnr: '19850101-0000', tabell: 33, bank: 'x' } }, '100003': { namn: 'Exempel Förare C', modell: 'procent', person: { personnr: '19950101-0000', tabell: 33 } }, '100004': { namn: 'Exempel Förare D', modell: 'procent', person: { personnr: '19700101-0000', tabell: 33, bank: 'x' } } } };
  }, [settingsQ.data, exempel, a.tenant.name]);
  const skatt = useMemo(() => skattQ.data?.tabeller || null, [skattQ.data]);
  const month = monthQ.data || { forare: {}, overrides: {}, files: {} };
  const fromCentral = useMemo(() => fromShare(share?.payload), [share]);
  const ldl = useMemo(() => {
    if (!exempel) return month.ldl || null;
    const regs = (share?.payload?.perBil || []).map((x: any) => [String(x.bil), x.reg.slice(0, 3) + ' ' + x.reg.slice(3)]);
    const bilar = (regs.length ? regs : [['901', 'QAB 12D'], ['902', 'QBC 34F']]).slice(0, 2);
    return ldlText({ period, bilar, forare: [['100001', '100002'], ['100003', '100004']].slice(0, bilar.length), foretag: a.tenant.name.toUpperCase(), seed: 99, skippa: 0.35 });
  }, [exempel, month.ldl, share, period, a.tenant.name]);
  const shifts = useMemo(() => (ldl ? hydrateShifts(ldl, period, settings, E) : []), [ldl, period, settings, E]);
  // Passager: egen PDF om åkaren laddat upp en, annars det centralen publicerat
  const passages = useMemo(() => {
    const bro = month.bro ? unpackP(month.bro, E) : fromCentral.bro;
    const stu = month.stu ? unpackP(month.stu, E) : fromCentral.stu;
    const regs = new Set(shifts.map(s => s.reg));
    return [...bro, ...stu].filter((p: any) => regs.has(p.reg));
  }, [month.bro, month.stu, fromCentral, shifts, E]);
  const allPassages = useMemo(() => [...(month.bro ? unpackP(month.bro, E) : fromCentral.bro), ...(month.stu ? unpackP(month.stu, E) : fromCentral.stu)], [month.bro, month.stu, fromCentral, E]);
  const R = useMemo(() => {
    if (!shifts.length) return null;
    return E.compute(shifts, passages, settings.cfg, computeInput(settings, month, shifts, { variant, period }));
  }, [shifts, passages, settings, month, variant, period, E]);
  const LS = useMemo(() => (R ? R.rows.map((r: any) => ({ r, L: lonespec({ r, c: R.cfg, person: settings.forare?.[r.id]?.person || {}, skatt, period, lonHist: settings.lonHist?.[r.id], ENG: E }) })) : []), [R, settings, skatt, period, E]);
  const cfg = { ...E.DEF, ...(settings.cfg || {}) };
  const namnFor = (id: string) => settings.forare?.[id]?.namn || '';
  return {
    loading: settingsQ.isLoading || monthQ.isLoading || sharesQ.isLoading,
    t, period, exempel, E, variant, settings, skatt, skattAr: skattQ.data?.ar || null, month, share, fromCentral, shifts, passages, allPassages, R, LS, cfg, namnFor,
    utbDatum: utbDatum(period, cfg), utbMan: utbMan(period, cfg), shares: sharesQ.data || []
  };
}
export type Kassa = ReturnType<typeof useKassa>;

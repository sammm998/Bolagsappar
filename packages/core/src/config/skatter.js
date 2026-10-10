// Skatter och avgifter med giltighetsdatum. Ändras årligen, ska inte ligga i motorerna.
// I plattformen läses tabellen från databasen (tabellen tax_rates, se supabase/migrations)
// och skickas in med setSatser. Värdena nedan är standard och samma som i prototyperna.

const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;

/** Arbetsgivaravgifter per period (ÅÅÅÅ-MM, from inklusive, tom inklusive, null = tills vidare). */
export const DEFAULT_SATSER = [
  {
    from: '2000-01', tom: null,
    arbetsgivaravgift: 0.3142,
    // Född 1937 eller tidigare: ingen avgift
    fodd_senast_noll: 1937,
    // Fyllt 66 vid årets ingång (född ar - 67 eller tidigare): bara ålderspensionsavgift
    pension_alder: 67, pension_sats: 0.1021,
    // Tillfälligt nedsatt avgift för unga (19 till 23 år vid årets ingång), april 2026 till september 2027
    ung: { from: '2026-04', tom: '2027-09', aldrar_fran: 19, aldrar_tom: 23, sats: 0.2081, tak: 25000 }
  }
];

/** Moms per typ. Används av Verkstad och i kontroller. */
export const DEFAULT_MOMS = [{ from: '2000-01', tom: null, normal: 0.25, livsmedel: 0.12, persontransport: 0.06 }];

let SATSER = DEFAULT_SATSER;
let MOMS = DEFAULT_MOMS;

/** Byt satser (från databasen). */
export function setSatser({ avgifter, moms } = {}) {
  if (avgifter?.length) SATSER = avgifter;
  if (moms?.length) MOMS = moms;
}
export function resetSatser() { SATSER = DEFAULT_SATSER; MOMS = DEFAULT_MOMS; }

const giltig = (L, man) => L.find(x => man >= x.from && (!x.tom || man <= x.tom)) || L[L.length - 1];
export const satserFor = man => giltig(SATSER, man);
export const momsFor = man => giltig(MOMS, man);

const pct = x => String(Math.round(x * 10000) / 100).replace('.', ',') + ' %';

/**
 * Arbetsgivaravgift efter ålder vid årets ingång och utbetalningsmånad (ÅÅÅÅ-MM).
 * Samma regler som agAvgift i prototypen, men satserna kommer från tabellen ovan.
 */
export function agAvgiftMedSatser(pnr, brutto, utbMan, fodelsear) {
  const T = satserFor(utbMan);
  const ar = +utbMan.slice(0, 4), f = fodelsear(pnr);
  if (!f) return { belopp: r2(brutto * T.arbetsgivaravgift), sats: pct(T.arbetsgivaravgift) };
  if (f <= T.fodd_senast_noll) return { belopp: 0, sats: '0 %' };
  if (f <= ar - T.pension_alder) return { belopp: r2(brutto * T.pension_sats), sats: pct(T.pension_sats) };
  const U = T.ung;
  const ung = U && f >= ar - U.aldrar_tom && f <= ar - U.aldrar_fran && utbMan >= U.from && utbMan <= U.tom;
  if (ung) { const lag = Math.min(brutto, U.tak); return { belopp: r2(lag * U.sats + (brutto - lag) * T.arbetsgivaravgift), sats: pct(U.sats) + ' upp till ' + String(U.tak).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' kr' }; }
  return { belopp: r2(brutto * T.arbetsgivaravgift), sats: pct(T.arbetsgivaravgift) };
}

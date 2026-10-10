// Prislistan. TILLFÄLLIGA priser tills ägaren har bestämt (öppen fråga 01). Ändra bara här.
// Alla belopp i kronor per månad, exkl. moms. "ingar" betyder att huvudkunden betalar (per ansluten underkund).

export const PRISER_TILLFALLIGA = true;

export const PRISER = {
  avrakning: { main: { manad: 4900, perUnderkund: 149 }, sub: 'ingar' },
  forarlista: { main: { manad: 990 }, sub: 'ingar' },
  kassan: { sub: { manad: 495 } },
  verkstad: { direct: { manad: 1490 } },
  skadeflode: { sub: { manad: 395 }, direct: { manad: 990 } },
  korjournal: { sub: { manad: 195 } }
};

/** Lägsta pris på hemsidan ("Från"). */
export const FRAN_PRIS = 1490;
/** Arbetsdagen och kartläggningen. */
export const ARBETSDAG = 0;

const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Pris för modul och variant: { manad, perUnderkund? }, 'ingar' eller null. */
export function prisFor(key, variant) { return PRISER[key]?.[variant] ?? null; }

/** Text i appbutiken: "495 kr/mån", "Ingår" eller "Pris på förfrågan". */
export function prisText(key, variant, { kort = true } = {}) {
  const p = prisFor(key, variant);
  if (p === 'ingar') return 'Ingår';
  if (!p) return 'Pris på förfrågan';
  const bas = `${fmt(p.manad)} kr${kort ? '/mån' : ' per månad'}`;
  return p.perUnderkund ? `${bas} + ${fmt(p.perUnderkund)} kr per åkare` : bas;
}
export const krManad = n => `${fmt(n)} kr per månad`;

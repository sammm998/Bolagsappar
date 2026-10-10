// Guidetexter per modul och variant. Hämtas av manifesten i @bolagsappar/modules.
import avrakningMain from './avrakning/main.js';
import avrakningSub from './avrakning/sub.js';
import forarlistaMain from './forarlista/main.js';
import forarlistaSub from './forarlista/sub.js';
import kassanSub from './kassan/sub.js';
import kassanMain from './kassan/main.js';
import verkstadDirect from './verkstad/direct.js';
import skadeflodeSub from './skadeflode/sub.js';
import skadeflodeDirect from './skadeflode/direct.js';
import korjournalSub from './korjournal/sub.js';

export const GUIDES = {
  avrakning: { main: avrakningMain, sub: avrakningSub },
  forarlista: { main: forarlistaMain, sub: forarlistaSub },
  kassan: { main: kassanMain, sub: kassanSub },
  verkstad: { direct: verkstadDirect },
  skadeflode: { sub: skadeflodeSub, direct: skadeflodeDirect },
  korjournal: { sub: korjournalSub }
};

/** Guide för modul och variant med {central} ersatt av huvudkundens namn. */
export function guideFor(moduleKey, variant, { central = 'centralen' } = {}) {
  const g = GUIDES[moduleKey]?.[variant] || GUIDES[moduleKey]?.main || null;
  if (!g) return null;
  return JSON.parse(JSON.stringify(g).replaceAll('{central}', central));
}

/** Gemensamt för alla appar (sidan 47). */
export const GEMENSAMT = {
  exempel: 'Prova med exempeldata',
  exempelBanner: 'Exempelläge. Siffrorna är påhittade och ingenting sparas.',
  sasFunkar: 'Så funkar det',
  varHittar: 'Var hittar jag filen?'
};

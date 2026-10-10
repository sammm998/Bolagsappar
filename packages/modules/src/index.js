import { guideFor } from '@bolagsappar/guides';
import avrakning from './avrakning.js';
import forarlista from './forarlista.js';
import kassan from './kassan.js';
import verkstad from './verkstad.js';
import skadeflode from './skadeflode.js';
import korjournal from './korjournal.js';
export { defineModule } from './define.js';

export const MODULES = [avrakning, forarlista, kassan, verkstad, skadeflode, korjournal];
export const moduleByKey = Object.fromEntries(MODULES.map(m => [m.key, m]));

/** Variant för ett konto: huvudkund ser main, underkund sub, direktkund direct (annars sub). */
export function variantFor(m, tenantType) {
  const v = tenantType === 'main' ? 'main' : tenantType === 'direct' ? (m.variants.direct ? 'direct' : 'sub') : 'sub';
  return m.variants[v] ? v : Object.keys(m.variants)[0];
}
export function guideForModule(key, variant, ctx) { return guideFor(key, variant, ctx); }

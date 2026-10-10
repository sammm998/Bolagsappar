import { describe, it, expect } from 'vitest';
import { MODULES, moduleByKey, variantFor } from './index.js';
import { GUIDES } from '@bolagsappar/guides';

describe('modulmanifest', () => {
  it('varje variant har en guide', () => {
    for (const m of MODULES) for (const v of Object.keys(m.variants)) if (!m.variants[v].erbjuds) expect(GUIDES[m.key]?.[v], m.key + '/' + v).toBeTruthy();
  });
  it('Avräkning: två obligatoriska filer för huvudkunden', () => {
    expect(moduleByKey.avrakning.uploads.filter(u => u.required).map(u => u.key)).toEqual(['tc', 'bamb']);
    expect(moduleByKey.avrakning.uploads).toHaveLength(8);
  });
  it('variant per kontotyp', () => {
    expect(variantFor(moduleByKey.avrakning, 'main')).toBe('main');
    expect(variantFor(moduleByKey.avrakning, 'sub')).toBe('sub');
    expect(variantFor(moduleByKey.verkstad, 'direct')).toBe('direct');
    expect(variantFor(moduleByKey.skadeflode, 'direct')).toBe('direct');
  });
});

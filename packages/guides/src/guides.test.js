import { describe, it, expect } from 'vitest';
import { GUIDES, guideFor } from './index.js';

describe('guiderna', () => {
  it('välkomstguiden har 1 till 5 kort och kom-igång-listan har unika nycklar', () => {
    for (const [m, V] of Object.entries(GUIDES)) for (const [v, g] of Object.entries(V)) {
      expect(g.welcome.length, m + '/' + v).toBeGreaterThanOrEqual(1);
      expect(g.welcome.length, m + '/' + v).toBeLessThanOrEqual(5);
      const keys = g.checklist.map(c => c.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it('inga tankstreck och svensk text', () => {
    const t = JSON.stringify(GUIDES);
    expect(t).not.toMatch(/[–—]/);
  });
  it('centralens namn byts in', () => {
    expect(guideFor('avrakning', 'sub', { central: 'Taxi Malmö' }).welcome[0].body).toContain('Taxi Malmös avräkning');
  });
});

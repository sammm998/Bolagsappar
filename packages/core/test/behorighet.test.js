import { describe, it, expect } from 'vitest';
import { godkannRoller, kanGodkanna } from '../src/behorighet.js';
describe('godkännande', () => {
  it('standard enligt specen: ägare, admin och ekonomi', () => {
    expect(godkannRoller({})).toEqual(['agare', 'admin', 'ekonomi']);
    expect(kanGodkanna({}, 'las')).toBe(false);
  });
  it('kontot kan begränsa, men ägaren får alltid och läs och förare aldrig', () => {
    const t = { settings: { godkannande: { roller: ['admin', 'las', 'forare'] } } };
    expect(godkannRoller(t)).toEqual(['agare', 'admin']);
    expect(kanGodkanna(t, 'ekonomi')).toBe(false);
  });
});

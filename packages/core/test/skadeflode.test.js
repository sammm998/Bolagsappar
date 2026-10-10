import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { kontroll, kontrollText, intagUtanAI, nyttArende, sen, setStatus, svarMall } from '../src/skadeflode/index.js';

// Kalkylraderna i prototypen (påhittade). Prototypen räknar "godkänt men ej debiterat" som summan av max(0, kalkyl minus arbetsorder).
const html = readFileSync(new URL('../../../legacy/apps/skadeflode/index.html', import.meta.url), 'utf8');
const rows = eval('[' + html.match(/rows:\[\s*([\s\S]*?)\]\s*\n\};/)[1] + ']');
const legacyMissing = rows.reduce((s, r) => s + Math.max(0, r[2] - r[3]), 0);

describe('skadeflöde', () => {
  it('kalkylkontroll ger samma belopp som prototypen', () => {
    const K = kontroll(rows);
    expect(K.ejDebiterat).toBe(legacyMissing);
    expect(K.ejDebiterat).toBe(2400);
    expect(K.rader.filter(r => r.flagga === 'saknas').map(r => r.moment)).toEqual(['Kalibrering frontkamera (ADAS)', 'Regnsensor, gelpad']);
    expect(K.rader.find(r => r.flagga === 'lagre').diff).toBe(-260);
  });
  it('kontrolltext utan AI tar upp varje avvikelse och självrisken', () => {
    const t = kontrollText({ kalkylrader: rows, sjalvrisk: 1500 });
    expect(t.split('\n')).toHaveLength(5);
    expect(t).toContain('2 400 kr godkänt men ej debiterat');
    expect(t).not.toMatch(/[–—]/);
  });
  it('läser ut uppgifter ur en skadeanmälan utan AI', () => {
    const k = intagUtanAI('Hej!\n\nBilen är en Exempelbil 2023, regnummer QRS 73L. Jag är försäkrad i Försäkring Exempel B och har skadenummer FB-4412093. Självrisken är 3 000 kr enligt mitt brev. Jag behöver lånebil.\n\nMvh\nKund Exempel\n070 000 00 00');
    expect(k).toMatchObject({ regnr: 'QRS73L', skadenr: 'FB-4412093', sjalvrisk: 3000, lanebil: true, bolag: 'Försäkring Exempel B', bil: 'Exempelbil 2023', kund: 'Kund Exempel', telefon: '070 000 00 00' });
    expect(k.saknas).toEqual([]);
    expect(intagUtanAI('Hej').saknas).toHaveLength(4);
  });
  it('nytt ärende, status och sena ärenden', () => {
    const a = nyttArende({ regnr: 'qrs 73l', sjalvrisk: '3000' }, ['S-201', 'S-198'], '2026-10-10');
    expect(a).toMatchObject({ id: 'S-202', reg: 'QRS73L', status: 'intag', sjalvrisk: 3000 });
    expect(sen(a, '2026-10-11')).toBe(false);
    expect(sen(a, '2026-10-12')).toBe(true);
    const b = setStatus(a, 'vantar', '2026-10-12');
    expect(b.logg).toHaveLength(2); expect(a.logg).toHaveLength(1);
    expect(svarMall(b, { amne: 'Fråga', fran: 'Handläggare A' }, 'Verkstaden')).toContain('Hej Handläggare,');
  });
});

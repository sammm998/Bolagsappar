import { describe, it, expect } from 'vitest';
import { parseUppdrag, avraknaLogistik, logistikPayload, LOGISTIK_DEF } from '../src/logistik/index.js';
import { jetpackUppdragCsv, JETPACK_UL } from '../testdata/demo.js';

const UL = JETPACK_UL.map((u, i) => ({ id: 'u' + i, namn: u.namn }));

describe('logistik (Jetpack, exempel)', () => {
  it('läser uppdragsfilen och hittar kolumner på namn', () => {
    const r = parseUppdrag(jetpackUppdragCsv({ antal: 20, extra: false }));
    expect(r.rader).toHaveLength(20);
    expect(r.rader[0]).toMatchObject({ id: 'JP-202609-0001' });
    expect(parseUppdrag('a;b\n1;2')).toBeNull();
    const eng = parseUppdrag('Date,Order ID,Carrier,Vehicle,Price\n2026-09-01,X1,Budfirma Exempel AB,QJB21C,"1000.50"\n');
    expect(eng.rader[0]).toMatchObject({ id: 'X1', ul: 'Budfirma Exempel AB', reg: 'QJB21C', pris: 1000.5 });
  });
  it('räknar per underleverantör och fångar dubblett, fel månad och okänd', () => {
    const { rader } = parseUppdrag(jetpackUppdragCsv());
    const R = avraknaLogistik(rader, { period: '2026-09', underleverantorer: UL });
    expect(R.varningar.map(v => v.typ).sort()).toEqual(['dubblett', 'manad', 'okand']);
    expect(R.summa.antal).toBe(140);
    for (const x of R.per) {
      expect(x.provision).toBeCloseTo(x.intakt * LOGISTIK_DEF.provision, 2);
      expect(x.uppdragsavgift).toBe(x.antal * LOGISTIK_DEF.perUppdrag);
      expect(x.netto).toBeCloseTo(x.intakt - x.provision - x.uppdragsavgift - x.fordonsavgift, 2);
      expect(x.att).toBeCloseTo(-(x.netto * 1.25), 2);
    }
  });
  it('enkel uträkning för hand', () => {
    const R = avraknaLogistik([{ datum: '2026-09-02', id: 'A', ul: 'Budfirma Exempel AB', reg: 'QJB21C', pris: 1000, tillagg: 0 }], { period: '2026-09', underleverantorer: UL });
    const x = R.per[0];
    expect([x.intakt, x.provision, x.uppdragsavgift, x.fordonsavgift, x.netto, x.moms, x.att]).toEqual([1000, 120, 15, 495, 370, 92.5, -462.5]);
    const p = logistikPayload(x, R, { fran: 'Jetpack' });
    expect(p).toMatchObject({ riktning: 'far', belopp: 462.5, utbetalas: '2026-10-10' });
    expect(p.sammanfattning.reduce((s, r) => s + r.belopp, 0)).toBeCloseTo(462.5, 2);
    expect(p.meddelande).not.toMatch(/[–—]/);
  });
});

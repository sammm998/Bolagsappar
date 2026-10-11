import { describe, it, expect } from 'vitest';
import { parseForarlista, perAkare, forarlistaCsv, exempelForarlista, datum } from '../src/forarlista.js';
import { forarlistaDemo, taxiMalmoSettings } from '../testdata/index.js';
import { readText } from '../src/filetypes/read.js';

const rows = text => readText('f.csv', text).bankRows;

describe('förarlista', () => {
  it('läser exempelfilen tillbaka till samma förare', () => {
    const S = taxiMalmoSettings();
    const fl = forarlistaDemo(S, { aktiva: 12, inaktiva: 5 });
    const r = parseForarlista(rows(forarlistaCsv(fl)), { idag: '2026-10-10' });
    expect(r.fel).toEqual([]);
    expect(r.forare).toHaveLength(17);
    expect(r.forare[0]).toMatchObject({ nr: fl.forare[0].nr, namn: fl.forare[0].namn, akeri: fl.forare[0].akeri, leg: fl.forare[0].leg, status: 'aktiv' });
    expect(r.forare.filter(f => f.status === 'aktiv')).toHaveLength(12);
  });
  it('hittar kolumner på engelska och räknar aktiv från senaste körning', () => {
    const r = parseForarlista(rows('Driver ID,First name,Last name,Company,Vehicle,License expiry,Last trip\n7,Test,Förare,Åkeri Norra AB,qab 12c,2027-03-31,2026-10-01\n8,Annan,Förare,Okänt AB,,31.01.2027,2026-01-01\n'), { idag: '2026-10-10' });
    expect(r.forare).toEqual([
      expect.objectContaining({ nr: '7', namn: 'Test Förare', senasteBil: 'QAB12C', leg: '2027-03', status: 'aktiv' }),
      expect.objectContaining({ nr: '8', leg: '2027-01', status: 'inaktiv' })
    ]);
  });
  it('säger nej till filer som inte är förarlistor och varnar för dubbletter', () => {
    expect(parseForarlista(rows('a;b\n1;2'))).toBeNull();
    const r = parseForarlista(rows('Förarnr;Namn;Åkeri\n1;A;X AB\n1;B;X AB\n;C;X AB\n'));
    expect(r.forare).toHaveLength(1);
    expect(r.fel.map(f => f.rad)).toEqual([3, 4]);
  });
  it('delar upp per åkare på namn och visar de som inte matchar', () => {
    const L = exempelForarlista(['Åkeri Norra AB', 'Taxi Syd AB'], '2026-10-10').forare.concat([{ nr: 'x', namn: 'Y', akeri: 'Okänt Åkeri' }]);
    const { per, utan } = perAkare(L, [{ id: 'a', name: 'ÅKERI NORRA' }, { id: 'b', name: 'Taxi Syd AB' }]);
    expect(per.map(p => [p.id, p.forare.length])).toEqual([['a', 3], ['b', 3]]);
    expect(utan).toEqual([{ akeri: 'Okänt Åkeri', antal: 1 }]);
  });
  it('tolkar datum', () => {
    expect(datum('2027-3')).toBe('2027-03');
    expect(datum('3/31/27')).toBe('2027-03-31');
    expect(datum('31/03/2027')).toBe('2027-03-31');
    expect(datum('okänt')).toBe('');
  });
});

// Filigenkänning per filtyp (sidan 11 och 48 i specifikationen).
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { readFile, readText, writeXlsx, sha256 } from '../src/filetypes/read.js';
import { FILKATALOG, filerFor, HJALPTEXT } from '../src/filetypes/catalog.js';
import * as A from '../src/avrakning/index.js';
import { taxiMalmoSettings, genMonth, taxiCallerCsv, taxiCallerPages, appCsv, oresundPages, sturupPages, bankRows } from '../testdata/index.js';

const S = taxiMalmoSettings();
const M = genMonth(S, '2026-10');
const fileOf = (name, data) => ({ name, arrayBuffer: async () => (data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : new TextEncoder().encode(data).buffer) });

describe('känner igen varje fil i Avräkning', () => {
  const fall = [
    ['TaxiCaller CSV', readText('deb.csv', taxiCallerCsv(M)), 'tc'],
    ['TaxiCaller PDF', { name: 'tc.pdf', kind: 'pdf', pages: taxiCallerPages(M) }, 'tc'],
    ['Appbetalningar', readText('app.csv', appCsv(M)), 'app'],
    ['Øresundsbro', { name: 'bro.pdf', kind: 'pdf', pages: oresundPages(M) }, 'bro'],
    ['Sturup', { name: 'sturup.pdf', kind: 'pdf', pages: sturupPages(M) }, 'sturup']
  ];
  for (const [namn, read, typ] of fall) it(namn, () => { expect(A.recognize(read, {}).type).toBe(typ); });

  it('Bambora via riktig Excel-fil', async () => {
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(M.bamb), 'Sales');
    const r = await readFile(fileOf('sales.xlsx', new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))));
    expect(r.kind).toBe('sheet');
    const rec = A.recognize(r, {});
    expect(rec.type).toBe('bamb');
    expect(rec.period).toBe('2026-10');
    expect(rec.bamb.length).toBe(M.bamb.filter(x => x.STATE === 'Cleared').length);
  });
  it('kontoutdrag via Excel', async () => {
    const data = writeXlsx([{ name: 'Blad1', rows: bankRows(S, '2026-10') }]);
    const r = await readFile(fileOf('konto.xlsx', data));
    const rec = A.recognize(r, {});
    expect(rec.type).toBe('bank');
    expect(rec.rows.length).toBe(18);
  });
  it('okänd fil får en hjälpsam text', () => {
    const rec = A.recognize(readText('lista.csv', 'a;b;c\n1;2;3'), {});
    expect(rec.type).toBe('unknown');
    expect(HJALPTEXT.okand(rec.hint)).toMatch(/^Vi känner inte igen filen\. Den ser ut som/);
  });
  it('fil för fel månad', () => {
    const M9 = genMonth(S, '2026-09', 3, { deb: 40, bamb: 0, app: 0, bro: 0, cph: 0, sturup: 0 });
    const rec = A.recognize(readText('deb.csv', taxiCallerCsv(M9)), {});
    expect(A.periodOf(rec, S)).toBe('2026-09');
    expect(HJALPTEXT.felManad('2026-08', '2026-09')).toBe('Filen gäller augusti. Du jobbar med september. Byt månad eller välj en annan fil.');
  });
  it('ofullständig PDF', () => {
    const pages = oresundPages(M);
    pages[0].push({ str: 'Sida 1 av 4', x: 500, y: 20 });
    const rec = A.recognize({ name: 'bro.pdf', kind: 'pdf', pages }, {});
    expect(rec.incomplete).toEqual({ total: 4, missing: [2, 3, 4] });
    expect(HJALPTEXT.ofullstandig([3, 4], 4, 'Øresundsbro')).toBe('Fakturan saknar sida 3 och 4 av 4. Ladda ner hela PDF:en från Øresundsbro igen.');
  });
  it('samma fil två gånger har samma kontrollsumma', async () => {
    const a = await sha256(new TextEncoder().encode(taxiCallerCsv(M)));
    const b = await sha256(new TextEncoder().encode(taxiCallerCsv(M)));
    expect(a).toBe(b);
    expect(HJALPTEXT.dubblett('2026-10-03')).toBe('Den här filen är redan inläst 2026-10-03. Vill du ersätta den?');
  });
});

describe('filkatalogen', () => {
  it('åtta filer i Avräkning plus bilregister, två obligatoriska', () => {
    const f = filerFor('avrakning');
    expect(f.length).toBe(9);
    expect(f.filter(x => x.kravs).map(x => x.key)).toEqual(['tc', 'bamb']);
  });
  it('varje fil har filhjälp', () => { for (const f of FILKATALOG) expect(f.hjalp.steg.length).toBeGreaterThan(0); });
  it('inga tankstreck i texterna', () => { expect(JSON.stringify(FILKATALOG)).not.toMatch(/[—–]/); });
});

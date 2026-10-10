// Läser en fil i webbläsaren (eller i Node i testerna) till en form som parsrarna förstår.
// Originalfilen lämnar aldrig datorn. Samma sätt att läsa som i prototyperna:
//  - PDF: pdf.js, text per sida med koordinater (pdfPages i avrakning, pdfLines i akarkassan)
//  - Excel och CSV: SheetJS
import * as XLSX from 'xlsx';

/** SHA-256 som hex, för dubbletter (file_runs.sha256). */
export async function sha256(buf) {
  const h = await globalThis.crypto.subtle.digest('SHA-256', buf instanceof ArrayBuffer ? buf : new Uint8Array(buf));
  return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/** Avkodar text som UTF-8, annars Windows-1252 (Megtax och Skatteverket). */
export function decodeText(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (e) { return new TextDecoder('windows-1252').decode(buf); }
}

/**
 * pdf.js laddas av den som anropar (webbläsare eller Node) och skickas in.
 * Returnerar { pages, rawPages }. pages har y nedåt efter viewport (som avrakning), rawPages har PDF-koordinater (som akarkassan).
 */
export async function readPdf(buf, pdfjs) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  const pages = [], rawPages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await doc.getPage(p), vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
    pages.push(tc.items.map(i => { const t = pdfjs.Util.transform(vp.transform, i.transform); return { str: i.str, x: t[4], y: t[5] }; }));
    rawPages.push(tc.items.map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5] })));
  }
  return { pages, rawPages };
}

/** Rader som akarkassans pdfLines: grupperade på avrundat y, uppifrån och ned. */
export function rawLines(rawPages) {
  const out = [];
  for (const items of rawPages) {
    const L = {};
    items.forEach(it => { if (!it.str || !it.str.trim()) return; const y = Math.round(it.y / 2); (L[y] = L[y] || []).push([it.x, it.str]); });
    Object.keys(L).sort((a, b) => b - a).forEach(y => out.push(L[y].sort((a, b) => a[0] - b[0]).map(x => x[1]).join(' ').replace(/\s+/g, ' ')));
  }
  return out;
}

/** Rader som folierings readFiles (bankgirospecifikation). */
export function rawLinesTol(rawPages) {
  const lines = [];
  for (const items of rawPages) {
    const rows = [];
    items.filter(i => i.str.trim()).forEach(i => { let r = rows.find(r => Math.abs(r.y - i.y) < 2.5); if (!r) rows.push(r = { y: i.y, it: [] }); r.it.push({ x: i.x, s: i.str }); });
    rows.sort((a, b) => b.y - a.y).forEach(r => lines.push(r.it.sort((a, b) => a.x - b.x).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim()));
  }
  return lines;
}

const ext = name => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';

/**
 * Läser en fil. file: { name, arrayBuffer() } (File i webbläsaren).
 * @returns {Promise<{name:string, ext:string, kind:'pdf'|'sheet'|'text', size:number, sha256:string, pages?:any[], rawPages?:any[], sheets?:object, sheetNames?:string[], csvRows?:any[], header?:string, text?:string, bankRows?:any[], csvText?:string}>}
 */
export async function readFile(file, { pdfjs } = {}) {
  const buf = await file.arrayBuffer();
  const name = file.name, e = ext(name);
  const base = { name, ext: e, size: buf.byteLength, sha256: await sha256(buf) };
  if (e === 'pdf') {
    if (!pdfjs) throw new Error('PDF-läsaren är inte laddad');
    const { pages, rawPages } = await readPdf(buf, pdfjs);
    return { ...base, kind: 'pdf', pages, rawPages };
  }
  if (e === 'xlsx' || e === 'xls') {
    const wb = XLSX.read(buf, { type: 'array' });
    const sheets = {}; for (const n of wb.SheetNames) sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n]);
    const wbd = XLSX.read(buf, { type: 'array', cellDates: true });
    const bankRows = XLSX.utils.sheet_to_json(wbd.Sheets[wbd.SheetNames[0]], { header: 1, raw: true });
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });
    const csvText = wb.SheetNames.map(n => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n');
    return { ...base, kind: 'sheet', sheets, sheetNames: wb.SheetNames, bankRows, rawRows, csvText };
  }
  const text = e === 'txt' || e === 'csv' || e === 'ldl' || e === '' ? decodeText(buf) : decodeText(buf);
  return { ...base, ...readText(name, text), size: buf.byteLength };
}

/** Text (CSV/TXT) till samma form som readFile. Används även direkt i testerna. */
export function readText(name, text) {
  const header = text.split('\n')[0];
  let csvRows = [], bankRows = [];
  try {
    const wb = XLSX.read(text, { type: 'string', raw: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    csvRows = XLSX.utils.sheet_to_json(ws, { raw: false });
    bankRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  } catch (e) { /* inte tabell */ }
  return { name, ext: ext(name), kind: 'text', text, header, csvRows, bankRows };
}

/** Excel från flikar [{name, rows, cols}] (excelSheets i avrakning/month.js). */
export function writeXlsx(sheets) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) { const ws = XLSX.utils.aoa_to_sheet(s.rows); if (s.cols) ws['!cols'] = s.cols.map(x => ({ wch: x })); XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31)); }
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

export { XLSX };

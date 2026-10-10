// PDF:er skapas i webbläsaren med jsPDF, som i prototyperna. Belopp i sv-SE, datum ÅÅÅÅ-MM-DD.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { kr2, manadAr } from '@bolagsappar/core/format';

const clean = (s: unknown) => String(s ?? '').replace(/[−‒–—]/g, '-').replace(/[   ]/g, ' ').replace(/…/g, '...');
const NAVY: [number, number, number] = [14, 30, 53], GREEN: [number, number, number] = [31, 77, 58], MUTED: [number, number, number] = [107, 115, 133], LINE: [number, number, number] = [231, 233, 237];
const TYP: Record<string, string> = { p: 'Person', b: 'Bud', u: 'Utland' };

function head(doc: jsPDF, kicker: string, title: string, sub: string) {
  doc.setFillColor(...NAVY); doc.rect(0, 0, 210, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...GREEN); doc.text(clean(kicker.toUpperCase()), 18, 16);
  doc.setFontSize(18); doc.setTextColor(...NAVY); doc.text(clean(title), 18, 25);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(clean(sub), 18, 31);
  doc.setDrawColor(...LINE); doc.line(18, 35, 192, 35);
}
function foot(doc: jsPDF, text: string) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text(clean(text), 18, 289); doc.text('Sida ' + i + ' av ' + n, 192, 289, { align: 'right' }); }
}
const table = (doc: jsPDF, startY: number, head: string[], body: (string | number)[][], right: number[] = []) => {
  autoTable(doc, { startY, head: [head.map(clean)], body: body.map(r => r.map(clean)), margin: { left: 18, right: 18 }, styles: { font: 'helvetica', fontSize: 8.2, cellPadding: 1.8, textColor: NAVY, lineColor: LINE, lineWidth: 0.1 }, headStyles: { fillColor: [247, 248, 249], textColor: MUTED, fontStyle: 'normal' }, columnStyles: Object.fromEntries(right.map(i => [i, { halign: 'right' }])), theme: 'grid' });
  return (doc as any).lastAutoTable.finalY as number;
};

/** Avräkningen för en åkare (det som publicerats). */
export function avrakningPdf(p: any): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  head(doc, `Avräkning från ${p.fran}`, p.namn, `${manadAr(p.period)}${p.version > 1 ? ', version ' + p.version : ''}${p.kn ? ', kundnr ' + p.kn : ''}`);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...NAVY);
  doc.text(clean(p.riktning === 'betalar' ? `Att betala ${kr2(p.belopp)} kr` : `Att få ${kr2(p.belopp)} kr`), 18, 45);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(clean(p.riktning === 'betalar' ? `Betalas senast ${p.utbetalas}` : `Utbetalas ${p.utbetalas}`), 18, 51);
  if (p.orsak) doc.text(clean('Rättelse: ' + p.orsak), 18, 56);
  let y = table(doc, 60, ['Sammanfattning', 'Belopp'], p.sammanfattning.map((r: any) => [r.text, kr2(r.belopp)]), [1]);
  y = table(doc, y + 6, ['Art', 'Benämning', 'Antal', 'À-pris', 'Summa', 'Moms'], p.rows.map((r: any) => [r.art ?? '', r.text, r.antal ?? '', kr2(r.apris), kr2(r.summa), r.moms + ' %']), [2, 3, 4, 5]);
  y = table(doc, y + 6, ['Bil', 'Reg nr', 'Intäkt inkl moms', 'Bro, Sturup, CPH', 'Netto'], p.perBil.map((x: any) => [x.bil, x.reg, kr2(x.intakt), kr2(x.avdrag), kr2(x.netto)]), [2, 3, 4]);
  for (const b of p.korningar || []) {
    if (!b.trips?.length) continue;
    doc.addPage(); head(doc, 'Specifikation per bil', `Bil ${b.bil} ${b.reg || ''}`, `${b.n} körningar, ${kr2(b.sum)} kr inkl moms`);
    table(doc, 40, ['Datum', 'Tid', 'Från', 'Till', 'Typ', 'Förare', 'Belopp'], b.trips.map((t: any) => [t.d, t.t, t.fran, t.till, TYP[t.y] || '', t.f, kr2(t.s)]), [6]);
  }
  const pas = [...(p.passager?.bro || []), ...(p.passager?.stu || [])];
  if (pas.length) {
    doc.addPage(); head(doc, 'Bro och Sturup', 'Passager per bil', `${pas.length} passager med tid`);
    table(doc, 40, ['Tid', 'Reg nr', 'Passage', 'Belopp'], pas.sort((a, b) => a.ts.localeCompare(b.ts)).map((x: any) => [x.ts.slice(0, 16), x.reg, x.desc, kr2(x.belopp) + ' ' + (x.valuta || 'SEK')]), [3]);
  }
  foot(doc, `${p.fran} · ${p.namn} · ${manadAr(p.period)}`);
  return doc.output('blob');
}

/** Lönespec (lonespec() i packages/core). */
export function lonespecPdf({ L, namn, id, foretag, period, utb }: { L: any; namn: string; id: string; foretag: string; period: string; utb: string }): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  head(doc, 'Lönespecifikation', namn || 'Förare ' + id, `${foretag} · ${manadAr(period)} · utbetalas ${utb}`);
  let y = table(doc, 42, ['Kod', 'Text', 'Antal', 'À-pris', 'Belopp'], L.rader.map((x: any) => [x.kod, x.text + (x.info ? ' (info)' : ''), String(x.antal).replace('.', ','), kr2(x.apris), kr2(x.belopp)]), [2, 3, 4]);
  y = table(doc, y + 6, ['', 'Belopp'], [['Bruttolön', kr2(L.brutto)], ['Skatt', kr2(-L.skatt)], ['Att utbetala', kr2(L.netto)], ['Arbetsgivaravgift (betalas av bolaget)', kr2(L.ag?.belopp ?? L.ag)]], [1]);
  if (L.ytd) table(doc, y + 6, ['Hittills i år', 'Belopp'], [['Bruttolön', kr2(L.ytd.lon)], ['Skatt', kr2(L.ytd.skatt)]], [1]);
  foot(doc, `${foretag} · Lönespecifikation ${manadAr(period)}`);
  return doc.output('blob');
}

/** Signerat avtal med underskrifter från pennan och signeringslogg. Som avPdf i prototypen. */
export function avtalPdf({ v, namn, foretag, orgnr, rubrik }: { v: any; namn: string; foretag: string; orgnr?: string; rubrik: string }): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  head(doc, rubrik, namn, `${foretag}${orgnr ? ', org.nr ' + orgnr : ''} · upprättat ${String(v.skapad).slice(0, 10)}`);
  let y = 44; const W = 174;
  const need = (h: number) => { if (y + h > 275) { doc.addPage(); y = 20; } };
  v.text.forEach((s: any, i: number) => {
    need(14); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NAVY); doc.text(clean((i + 1) + '. ' + s.h), 18, y); y += 5.5;
    s.p.forEach((t: string) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(9.2); (doc.splitTextToSize(clean(t), W) as string[]).forEach(l => { need(5); doc.text(l, 18, y); y += 4.5; }); y += 2; });
    y += 2;
  });
  need(62); y += 4; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Underskrifter', 18, y); y += 4;
  ([['arbg', 'För arbetsgivaren, ' + foretag], ['anst', 'Arbetstagare']] as const).forEach(([k, lbl], j) => {
    const s = v.sign?.[k]; if (!s) return; const x = 18 + j * (W / 2 + 3), w = W / 2 - 3;
    try { doc.addImage(s.png, s.png.startsWith('data:image/png') ? 'PNG' : 'SVG' as any, x, y + 2, 58, 18); } catch { /* bild saknas */ }
    doc.setDrawColor(...NAVY); doc.line(x, y + 22, x + w, y + 22);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(clean(s.namn), x, y + 27);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(...MUTED); doc.text(clean(lbl), x, y + 31.5); doc.text(clean(`${s.ort}, ${String(s.tid).slice(0, 10)}`), x, y + 35.5); doc.setTextColor(...NAVY);
  });
  y += 42; need(18);
  doc.setFillColor(247, 248, 249); doc.roundedRect(18, y, W, 16, 1.5, 1.5, 'F');
  doc.setFontSize(7); doc.setTextColor(...MUTED);
  doc.text(clean(`Signeringslogg: arbetstagaren ${v.sign?.anst?.tid?.slice(0, 16).replace('T', ' ') || ''}, arbetsgivaren ${v.sign?.arbg?.tid?.slice(0, 16).replace('T', ' ') || ''}. Signerat med penna i Bolagsappar.`), 22, y + 6);
  doc.text(clean('Kontrollsumma (SHA-256) för avtalstexten: ' + v.hash), 22, y + 11);
  foot(doc, `${foretag} · ${rubrik} ${namn}`);
  return doc.output('blob');
}

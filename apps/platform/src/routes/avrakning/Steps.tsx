// De fyra stegen i Avräkning (sidan 31 till 33).
import { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Banner, Button, Card, Checkbox, Deviation, DropZone, EmptyState, FileRow, Icon, Kpi, Modal, Pill, Select, Textarea, useToast, Input, Tag } from '@bolagsappar/ui';
import * as A from '@bolagsappar/core/avrakning';
import { writeXlsx } from '@bolagsappar/core/filetypes';
import { genMonth, taxiMalmoSettings, bankRows } from '@bolagsappar/core/testdata';
import { kr2, krs, manad, Manad, manadAr, tal, ymAdd, dagText, pct } from '@bolagsappar/core/format';
import { useAccount } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useNetwork } from '../../lib/q';
import { UPLOADS, M } from '../../lib/avr';
import { download } from '../../lib/files';
import { useHelpCtx } from '../../shell/Help';
import { useMonth, devKey, type Pending } from './model';
import { StepActions, useStepNav } from './Layout';

// ------------------------------------------------------------------ Steg 1: Månadens filer
export function Filer() {
  const m = useMonth(); const a = useAccount(); const toast = useToast(); const help = useHelpCtx(); const go = useStepNav(); const b = useBackend();
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [bank, setBank] = useState<any[] | null>(null);
  const runs = m.runs;
  const rows = UPLOADS.map(u => ({ u, run: runs.find((r: any) => r.kind === u.key) }));
  const done = rows.filter(r => r.run).length;
  const required = UPLOADS.filter(u => u.kravs).every(u => runs.some((r: any) => r.kind === u.key));
  const onFiles = async (files: File[]) => {
    if (m.locked) { toast(m.status === 'publicerad' ? 'Månaden är publicerad och kan inte ändras. Gör en rättelse under Godkänn.' : 'Månaden är godkänd. Öppna den igen under Godkänn för att ändra.', { tone: 'bad' }); return; }
    setBusy(true);
    try { setPending(await m.analyze(files)); } finally { setBusy(false); }
  };
  const save = async () => {
    if (!pending) return;
    const bankP = pending.find(p => p.status === 'bank');
    setBusy(true);
    try {
      const msgs = await m.commit(pending);
      const n = pending.filter(p => ['ok', 'dubblett', 'ofullstandig'].includes(p.status)).length;
      if (n) toast(`${n} ${n === 1 ? 'fil sparad' : 'filer sparade'} för ${manad(m.period)}.`);
      msgs.forEach(x => toast(x));
      setPending(null);
      if (bankP) setBank(A.suggestForskott(bankP.rec.rows, m.S, m.D, m.S.fMap || {}));
    } catch (e: any) { toast(e.message || 'Kunde inte spara.', { tone: 'bad' }); }
    setBusy(false);
  };
  return (
    <>
      <StepActions><Button variant="primary" iconRight="arrow" disabled={!required} onClick={() => go('kontroll')} title={required ? undefined : 'TaxiCaller kontofakturor och Bambora behövs först'}>Till kontroll</Button></StepActions>
      <div className="ba-stack" style={{ gap: 18 }}>
        {m.locked ? <Banner tone="info">{m.status === 'publicerad' ? `${manadAr(m.period)} är publicerad. Filerna visas men kan inte ändras.` : `${manadAr(m.period)} är godkänd och låst. Öppna den igen under Godkänn för att ändra.`}</Banner>
          : <DropZone onFiles={onFiles} title={busy ? 'Läser filerna…' : 'Dra in månadens filer här'} text="Alla på en gång går bra. Vi känner igen vilken fil som är vilken. Filerna läses i din webbläsare." accept=".pdf,.csv,.txt,.xlsx,.xls" />}
        <div>
          <div className="pf-section-h"><h2>{done} av {UPLOADS.length} filer</h2><span className="ba-grow" /><span className="small muted">Obligatoriska: TaxiCaller kontofakturor och Bambora</span></div>
          <div className="ba-grid ba-grid--2" style={{ gap: 10 }}>
            {rows.map(({ u, run }) => (
              <FileRow key={u.key} source={`${u.kalla} · ${u.format}`} title={u.label.replace(/^(TaxiCaller|Bambora|Visma|Handelsbanken|Swedavia) /, '').replace(/^./, c => c.toUpperCase())}
                sub={run ? (run.summary?.text || run.filename) : null} status={run ? 'ok' : 'missing'} onHelp={() => help.showFile('avrakning', u.key)}
                action={run ? (!m.locked && <Button size="sm" variant="link" onClick={() => document.querySelector<HTMLInputElement>('.ba-drop input[type=file]')?.click()}>Byt</Button>) : <Pill tone="warn" dot={false}>Saknas</Pill>} />
            ))}
          </div>
        </div>
        {m.D?.reskontra && !m.locked && <Card><Checkbox label="Räkna in tidigare skulder från kundreskontran" checked={!!m.D.skuldMed} onChange={e => m.setSkuldMed(e.target.checked)} /><p className="small muted" style={{ margin: '6px 0 0' }}>Bocka i först när ekonomen har registrerat alla betalningar i Visma.</p></Card>}
        {m.D?.forskottRad?.length > 0 && <Card title={`Förskott, ${m.D.forskottRad.length} st`} actions={!m.locked && <Button size="sm" onClick={() => setBank(null)}>Ändra under Kontroll</Button>}><p className="small muted" style={{ margin: 0 }}>{krs(m.D.forskottRad.reduce((s: number, f: any) => s + f.belopp, 0), false)} dras från åkarnas avräkningar som rad 59.</p></Card>}
        {b.kind === 'lokal' && !m.exempel && !m.locked && <ExempelFiler />}
      </div>
      <PendingDialog list={pending} busy={busy} onClose={() => setPending(null)} onSave={save} />
      {bank && <ForskottDialog rows={bank} onClose={() => setBank(null)} />}
    </>
  );
}

function PendingDialog({ list, busy, onClose, onSave }: { list: Pending[] | null; busy: boolean; onClose: () => void; onSave: () => void }) {
  const a = useAccount(); const m = useMonth();
  if (!list) return null;
  const ok = list.filter(p => ['ok', 'dubblett', 'ofullstandig', 'bank'].includes(p.status)).length;
  return (
    <Modal open onClose={onClose} title="Det här hittade vi" labelledBy="pend-h" wide footer={<><span className="small muted ba-grow">Inget sparas förrän du bekräftar.</span><Button onClick={onClose}>Avbryt</Button><Button variant="primary" icon="check" disabled={!ok} loading={busy} onClick={onSave}>{ok === 1 ? 'Spara filen' : `Spara ${ok} filer`}</Button></>}>
      <ul className="pf-list-plain ba-stack" style={{ gap: 10 }}>
        {list.map((p, i) => (
          <li key={i} className="ba-file" style={{ alignItems: 'flex-start' }}>
            <span className={'ba-file__icon'} style={p.status === 'ok' || p.status === 'bank' ? undefined : { background: p.status === 'dubblett' || p.status === 'ofullstandig' ? 'var(--warn-bg)' : 'var(--bad-bg)', color: p.status === 'dubblett' || p.status === 'ofullstandig' ? 'var(--warn)' : 'var(--bad)' }}><Icon name={p.status === 'ok' || p.status === 'bank' ? 'check' : 'alert'} size={14} /></span>
            <div className="ba-grow">
              <div className="ba-file__src">{p.name}</div>
              <div className="ba-file__title">{p.rec ? (UPLOADS.find(u => u.key === (p.rec.type === 'passager' ? 'sturup' : p.rec.type))?.label || 'Okänd fil') : 'Okänd fil'}</div>
              <div className="small" style={{ marginTop: 2 }}>{p.summary || p.message}</div>
              {p.status === 'dubblett' && <div className="small muted">Sparar du ersätts den tidigare inläsningen.</div>}
              {p.status === 'felManad' && p.period && <Link className="small" to="/$tenant/avrakning/$period/filer" params={{ tenant: a.tenant.slug, period: p.period }} onClick={onClose} search={m.exempel ? { exempel: 1 } : {}}>Byt till {manadAr(p.period).toLowerCase()}</Link>}
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function ExempelFiler() {
  const m = useMonth();
  // Samma frö som demodatan för oktober, så att filerna passar ihop med det som redan är inläst
  const files = () => { const S = taxiMalmoSettings(); return { S, Mx: genMonth(S, m.period, m.period === '2026-10' ? 200 : 300) }; };
  return (
    <Card tone="subtle" title="Exempelfiler för demon">
      <p className="small muted" style={{ margin: '0 0 10px' }}>Påhittade filer i samma format som källsystemen. Ladda ner och dra in dem ovan för att prova hela flödet.</p>
      <div className="ba-row">
        <Button size="sm" icon="download" onClick={() => { const { Mx } = files(); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Mx.bamb), 'Sales'); download(`Bambora_sales_${m.period}.xlsx`, new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))); }}>Bambora sales-export</Button>
        <Button size="sm" icon="download" onClick={() => { const { S } = files(); download(`Kontotransaktioner_${m.period}.xlsx`, writeXlsx([{ name: 'Kontotransaktioner', rows: bankRows(S, m.period) }])); }}>Kontoutdrag</Button>
      </div>
    </Card>
  );
}

export function ForskottDialog({ rows: rows0, onClose }: { rows: any[]; onClose: () => void }) {
  const m = useMonth(); const toast = useToast();
  const [rows, setRows] = useState(() => { const OK = A.otherMonthKeys(m.months, m.period); return rows0.map(r => ({ ...r, annan: OK[A.fKey(r)] || null, med: OK[A.fKey(r)] ? false : r.med })); });
  const [[from, to], setRange] = useState(A.defaultRange(m.period));
  const [alla, setAlla] = useState(false);
  const L = rows.filter(r => r.datum >= from && r.datum <= to && (alla || r.belopp < 0));
  const sel = L.filter(r => r.med && !r.annan && r.bolag);
  const names = m.S.bolag.map((b: any) => b.namn);
  const upd = (i: number, patch: any) => setRows(rs => rs.map(r => r.i === i ? { ...r, ...patch } : r));
  const save = async () => { const res = A.saveForskott(rows, from, to, m.S.fMap || {}); await m.saveForskott(res.forskottRad, res.fMap); toast(`${res.forskottRad.length} förskott sparade för ${manad(m.period)}.`); onClose(); };
  return (
    <Modal open onClose={onClose} wide title={`Förskott ${manadAr(m.period).toLowerCase()}`} labelledBy="fsk-h" footer={<><span className="small muted ba-grow">{sel.length} valda, {krs(sel.reduce((s, r) => s + Math.abs(r.belopp), 0), false)}</span><Button onClick={onClose}>Avbryt</Button><Button variant="primary" icon="check" onClick={save}>Spara förskott</Button></>}>
      <p className="small muted" style={{ marginTop: 0 }}>Bocka i det som är förskott. Kopplingen mellan banktext och bolag sparas, så nästa månad hittas de automatiskt. Förskott som redan ligger på en annan månad kan inte väljas igen.</p>
      <div className="ba-row" style={{ marginBottom: 10 }}><label className="small">Från <Input type="date" value={from} onChange={e => setRange([e.target.value, to])} style={{ width: 160, height: 36 }} /></label><label className="small">till <Input type="date" value={to} onChange={e => setRange([from, e.target.value])} style={{ width: 160, height: 36 }} /></label><Checkbox label="visa även insättningar" checked={alla} onChange={e => setAlla(e.target.checked)} /></div>
      <div className="ba-table-wrap" style={{ maxHeight: 380, overflow: 'auto' }}>
        <table className="ba-table"><thead><tr><th>Förskott</th><th>Datum</th><th>Text i banken</th><th className="n">Belopp</th><th>Bolag</th><th /></tr></thead>
          <tbody>{L.map(r => (
            <tr key={r.i}><td><input type="checkbox" aria-label="Förskott" checked={!!r.med} disabled={!!r.annan} onChange={e => upd(r.i, { med: e.target.checked })} />{r.annan && <> <Pill tone="info" dot={false}>på {manad(r.annan)}</Pill></>}</td>
              <td className="num">{r.datum}</td><td>{r.text}</td><td className="n">{kr2(r.belopp)}</td>
              <td><Select value={r.bolag} onChange={e => upd(r.i, { bolag: e.target.value, kalla: e.target.value ? 'vald' : '', med: !!e.target.value || r.med })} aria-label="Bolag" style={{ height: 34 }}><option value="">Välj bolag</option>{names.map((n: string) => <option key={n}>{n}</option>)}</Select></td>
              <td>{r.kalla && <Pill tone={r.kalla === 'sparad' ? 'ok' : 'warn'} dot={false}>{r.kalla}</Pill>}</td></tr>
          ))}</tbody></table>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Steg 2: Kontroll
const TABS = [['akare', 'Per åkare'], ['bil', 'Per bil'], ['kund', 'Kundfakturor'], ['forskott', 'Förskott'], ['manuella', 'Manuella poster'], ['alla', 'Alla kontroller']] as const;

export function Kontroll() {
  const m = useMonth(); const go = useStepNav();
  const [tab, setTab] = useState<string>('akare');
  const [open, setOpen] = useState<string | null>(null);
  const [bank, setBank] = useState<any[] | null>(null);
  const R = m.R;
  if (!R) return <EmptyState title="Inget att kontrollera än" action={<Button variant="primary" onClick={() => go('filer')}>Till filerna</Button>}>Dra in TaxiCaller och Bambora först.</EmptyState>;
  const aktiva = R.bolag.filter((b: any) => b.aktiv);
  const devs = [...R.kontroll.filter((k: any) => k.niva === 'fel'), ...m.avvikelser.filter((x: any) => x.niva === 'fel'), ...R.kontroll.filter((k: any) => k.niva === 'info' && /Visma|Kundfaktura avviker/.test(k.typ))]
    .filter((k: any, i: number, L: any[]) => L.findIndex(x => devKey(x) === devKey(k)) === i);
  const klara = devs.filter(d => m.marks[devKey(d)]).length;
  const utbet = -aktiva.filter((b: any) => b.att < 0).reduce((s: number, b: any) => s + b.att, 0);
  const prevUt = m.prevSummary?.bolag ? -m.prevSummary.bolag.filter((b: any) => b.att < 0).reduce((s: number, b: any) => s + b.att, 0) : null;
  const inbet = aktiva.filter((b: any) => b.att > 0);
  const bolagFor = (k: any) => k.bolag || aktiva.find((b: any) => String(k.vad || '').startsWith(b.namn))?.namn || null;
  const devBolag = new Set(devs.filter(d => !m.marks[devKey(d)]).map(bolagFor).filter(Boolean));
  const vismaBolag = new Set(R.kontroll.filter((k: any) => k.typ === 'Avviker mot Visma').map(bolagFor));
  const xl = () => download(`Avrakning_${m.period}.xlsx`, writeXlsx(A.excelSheets(R, m.D.forskottRad)));
  return (
    <>
      <StepActions><Button icon="download" onClick={xl}>Excel</Button><Button variant="primary" iconRight="arrow" onClick={() => go('godkann')}>Till godkännande</Button></StepActions>
      <div className="pf-sidebar-layout">
        <section aria-labelledby="titta-h">
          <div className="pf-section-h"><h2 id="titta-h">Saker att titta på</h2><span className="ba-grow" /><span className="small muted">{klara} av {devs.length} klara</span></div>
          <div className="ba-stack" style={{ gap: 10 }}>
            {devs.length === 0 && <Card tone="subtle"><EmptyState icon="check" title="Inga avvikelser">Allt i månadens filer gick att koppla till bil och bolag.</EmptyState></Card>}
            {devs.map(d => {
              const key = devKey(d), done = !!m.marks[key], who = bolagFor(d);
              return <Deviation key={key} tone={done ? 'done' : d.typ.startsWith('Avviker mot Visma') || d.niva === 'info' ? 'warn' : 'bad'} who={who || undefined} title={d.typ.replace('Avviker mot Visma', 'Skiljer ' + kr2(Math.abs(d.belopp || 0)) + ' kr mot Visma')}
                text={(who ? String(d.vad).replace(who + ', ', '').replace(who + ': ', '').replace(who, '') : d.vad) + (d.atgard ? '. ' + d.atgard : '')}
                actions={[...(who ? [{ label: 'Visa raderna', onClick: () => { setTab('akare'); setOpen(who); setTimeout(() => document.getElementById('rad-' + who)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); } }] : []), { label: done ? 'Ångra kontrollerad' : 'Markera som kontrollerad', onClick: () => m.mark(key, !done) }]} />;
            })}
          </div>
        </section>
        <section>
          <div className="ba-grid ba-grid--3">
            <Kpi label="Att betala till åkare" value={krs(utbet)} sub={prevUt ? `${utbet >= prevUt ? '+' : ''}${pct((utbet - prevUt) / prevUt * 100)} mot ${manad(ymAdd(m.period, -1))}` : undefined} subTone="ok" />
            <Kpi label="Åkare som ska betala in" value={tal(inbet.length)} sub={`${krs(inbet.reduce((s: number, b: any) => s + b.att, 0))} totalt`} />
            <Kpi label="Körningar" value={tal(R.kpi.korningar)} sub={`${R.perBil.length} bilar`} />
          </div>
          <nav className="ba-tabs" style={{ margin: '18px 0 12px' }} role="tablist">
            {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{k === 'alla' && R.kpi.fel ? <span className="cnt">{R.kpi.fel}</span> : null}</button>)}
          </nav>
          {tab === 'akare' && <PerAkare open={open} setOpen={setOpen} devBolag={devBolag as Set<string>} vismaBolag={vismaBolag as Set<string>} />}
          {tab === 'bil' && <PerBil />}
          {tab === 'kund' && <Kund />}
          {tab === 'forskott' && <ForskottTab onBank={setBank} />}
          {tab === 'manuella' && <Manuella />}
          {tab === 'alla' && <AllaKontroller />}
        </section>
      </div>
      {bank && <ForskottDialog rows={bank} onClose={() => setBank(null)} />}
    </>
  );
}

function PerAkare({ open, setOpen, devBolag, vismaBolag }: { open: string | null; setOpen: (s: string | null) => void; devBolag: Set<string>; vismaBolag: Set<string> }) {
  const m = useMonth(); const R = m.R;
  const rows = R.bolag.filter((b: any) => b.aktiv).map((b: any) => {
    const s = A.sammanfattning(b, m.S.params);
    const g = (k: string) => s.filter((x: any) => x.key === k).reduce((a: number, x: any) => a + x.belopp, 0);
    return { b, intakt: g('intakt'), avgifter: g('avgifter') + g('avrundning'), avdrag: g('bro') + g('sturup') + g('forskott') + g('skuld') + g('ovrigt') };
  }).sort((x: any, y: any) => (devBolag.has(y.b.namn) ? 1 : 0) - (devBolag.has(x.b.namn) ? 1 : 0) || x.b.namn.localeCompare(y.b.namn, 'sv'));
  return (
    <div className="ba-table-wrap">
      <table className="ba-table">
        <thead><tr><th>Åkeri</th><th className="n">Intäkt</th><th className="n">Avgifter</th><th className="n">Avdrag</th><th className="n">Att betala</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map(({ b, intakt, avgifter, avdrag }: any) => {
            const st = devBolag.has(b.namn) ? ['bad', 'Kontrollera'] : vismaBolag.has(b.namn) ? ['warn', 'Visma'] : ['ok', 'OK'];
            const isOpen = open === b.namn;
            return [
              <tr key={b.namn} id={'rad-' + b.namn} className={'click' + (st[0] === 'bad' ? ' hl' : '')} onClick={() => setOpen(isOpen ? null : b.namn)} aria-expanded={isOpen}>
                <td className="b">{b.namn}</td><td className="n">{kr2(intakt)}</td><td className="n">{kr2(avgifter)}</td><td className="n">{kr2(avdrag)}</td><td className="n strong">{kr2(-b.att)}</td><td><Pill tone={st[0] as any}>{st[1]}</Pill></td>
              </tr>,
              isOpen && <tr key={b.namn + '-rader'}><td colSpan={6} style={{ background: 'var(--subtle)', padding: 0 }}><Fakturarader b={b} /></td></tr>
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
function Fakturarader({ b }: { b: any }) {
  return (
    <div style={{ padding: '10px 14px 14px' }}>
      <div className="small muted" style={{ marginBottom: 6 }}>Fakturarader för Visma. Kundnr {b.kn}. Bilar {b.bilar.join(', ')}. Negativt belopp betyder att centralen betalar åkaren.</div>
      <table className="ba-table" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 8 }}>
        <thead><tr><th>Art</th><th>Benämning</th><th className="n">Antal</th><th className="n">À-pris</th><th className="n">Summa</th><th className="n">Moms</th></tr></thead>
        <tbody>{b.rows.map((r: any, i: number) => <tr key={i}><td className="num">{r.art ?? ''}</td><td>{r.text}{r.bak && <> <Pill tone="info" dot={false}>efterdeb.</Pill></>}{r.rabattPct ? <> <Pill tone="info" dot={false}>rabatt {r.rabattPct} %</Pill></> : null}</td><td className="n">{r.antal}</td><td className="n">{kr2(r.apris)}</td><td className="n">{kr2(r.summa)}</td><td className="n">{r.moms} %</td></tr>)}</tbody>
        <tfoot><tr><td colSpan={4}>Netto {kr2(b.netto)} · moms 25 % {kr2(b.moms25)} · moms 6 % {kr2(b.moms6)}</td><td className="n" colSpan={2}>Att betala {kr2(b.att)}</td></tr></tfoot>
      </table>
    </div>
  );
}
function PerBil() {
  const m = useMonth();
  return (
    <div className="ba-table-wrap"><table className="ba-table">
      <thead><tr><th>Bil</th><th>Reg nr</th><th>Avräknas på</th><th className="n">Kontokort</th><th className="n">Dricks</th><th className="n">Deb</th><th className="n">App</th><th className="n">Bro</th><th className="n">Sturup</th><th className="n">CPH</th></tr></thead>
      <tbody>{m.R.perBil.map((x: any) => <tr key={x.bil}><td className="num">{x.bil}</td><td className="num">{x.reg}</td><td>{x.bolag}</td><td className="n">{kr2(x.kort)}</td><td className="n">{kr2(x.dricks)}</td><td className="n">{kr2(x.person + x.bud + x.utland)}</td><td className="n">{kr2(x.app)}</td><td className="n">{x.bro || ''}</td><td className="n">{x.sturup || ''}</td><td className="n">{x.cph || ''}</td></tr>)}</tbody>
    </table></div>
  );
}
function Kund() {
  const m = useMonth();
  return (
    <div className="ba-table-wrap"><table className="ba-table">
      <thead><tr><th>Konto</th><th>Namn</th><th className="n">Körningar</th><th className="n">592 exkl moms</th><th className="n">593 bud</th><th className="n">594 utland</th><th className="n">Totalt</th><th className="n">Diff mot TaxiCaller</th></tr></thead>
      <tbody>{m.R.kund.map((k: any) => <tr key={k.nr} className={k.diff ? 'hl' : ''}><td className="num">{k.nr}</td><td>{k.namn}</td><td className="n">{k.n}</td><td className="n">{kr2(k.r592)}</td><td className="n">{kr2(k.r593)}</td><td className="n">{kr2(k.r594)}</td><td className="n strong">{kr2(k.total)}</td><td className="n">{k.diff == null ? '' : kr2(k.diff)}</td></tr>)}</tbody>
    </table></div>
  );
}
function ForskottTab({ onBank }: { onBank: (r: any[]) => void }) {
  const m = useMonth(); const toast = useToast();
  const L = m.D.forskottRad || [];
  const pick = async (files: File[]) => {
    const p = (await m.analyze(files))[0];
    if (p?.status !== 'bank') { toast(p?.message || 'Det där var inget kontoutdrag.', { tone: 'bad' }); return; }
    onBank(A.suggestForskott(p.rec.rows, m.S, m.D, m.S.fMap || {}));
  };
  return (
    <div className="ba-stack">
      {!m.locked && <DropZone compact title="Läs in kontoutdrag" onFiles={pick} accept=".xlsx,.xls,.csv,.txt,.pdf" multiple={false} />}
      {L.length ? (
        <div className="ba-table-wrap"><table className="ba-table"><thead><tr><th>Datum</th><th>Text i banken</th><th>Bolag</th><th className="n">Belopp</th></tr></thead><tbody>{L.map((f: any) => <tr key={A.fKey(f)}><td className="num">{f.datum}</td><td>{f.text}</td><td>{f.bolag}</td><td className="n">{kr2(f.belopp)}</td></tr>)}</tbody></table></div>
      ) : <EmptyState icon="bank" title="Inga förskott">Förskotten hamnar på respektive åkares avräkning som rad 59 med datum.</EmptyState>}
    </div>
  );
}
function Manuella() {
  const m = useMonth(); const toast = useToast();
  const aktiva = m.R.bolag.filter((b: any) => b.aktiv);
  const [bolag, setBolag] = useState(aktiva[0]?.namn || '');
  const cur = m.D.manuellt?.[bolag] || {};
  const [f, setF] = useState<any>(null);
  const v = f && f.bolag === bolag ? f : { bolag, forskott: cur.forskott ?? '', oppna: cur.oppna ?? '', rabatt: cur.rabatt ?? '', vxBak: cur.vxBak ?? '', tlBak: cur.tlBak ?? '', extra: cur.extra || [] };
  const set = (k: string, x: any) => setF({ ...v, [k]: x });
  const save = async () => { const { bolag: _b, ...patch } = v; await m.saveManuellt(bolag, patch); setF(null); toast('Manuella poster sparade för ' + bolag + '.'); };
  return (
    <Card>
      <div className="ba-row" style={{ marginBottom: 12 }}><Select value={bolag} onChange={e => { setBolag(e.target.value); setF(null); }} aria-label="Åkeri" style={{ maxWidth: 320 }}>{aktiva.map((b: any) => <option key={b.namn}>{b.namn}</option>)}</Select><span className="ba-grow" />{!m.locked && <Button variant="dark" onClick={save}>Spara</Button>}</div>
      <div className="ba-grid ba-grid--3">
        {[['forskott', 'Förskott (kr)'], ['oppna', 'Övriga poster (kr)'], ['rabatt', 'Rabatt växelavgift (kr)'], ['vxBak', 'Efterdebitering växelavgift, antal'], ['tlBak', 'Efterdebitering taklampa, antal']].map(([k, l]) => <label key={k} className="ba-field"><span className="ba-label">{l}</span><Input mono value={v[k]} disabled={m.locked} onChange={e => set(k, e.target.value)} inputMode="decimal" /></label>)}
      </div>
      <h3 style={{ fontSize: 13.5, margin: '18px 0 8px' }}>Övriga rader</h3>
      {(v.extra || []).map((e: any, i: number) => (
        <div key={i} className="ba-row" style={{ marginBottom: 6 }}>
          <Input placeholder="Text" value={e.text} disabled={m.locked} onChange={x => set('extra', v.extra.map((y: any, j: number) => j === i ? { ...y, text: x.target.value } : y))} style={{ flex: 2, minWidth: 160 }} />
          <Input mono placeholder="Antal" value={e.antal ?? ''} disabled={m.locked} onChange={x => set('extra', v.extra.map((y: any, j: number) => j === i ? { ...y, antal: x.target.value } : y))} style={{ width: 80 }} />
          <Input mono placeholder="À-pris" value={e.apris ?? ''} disabled={m.locked} onChange={x => set('extra', v.extra.map((y: any, j: number) => j === i ? { ...y, apris: x.target.value } : y))} style={{ width: 110 }} />
          <Select value={e.moms ?? 25} disabled={m.locked} onChange={x => set('extra', v.extra.map((y: any, j: number) => j === i ? { ...y, moms: +x.target.value } : y))} style={{ width: 90 }} aria-label="Moms"><option value={25}>25 %</option><option value={6}>6 %</option><option value={0}>0 %</option></Select>
          {!m.locked && <Button size="sm" variant="link" onClick={() => set('extra', v.extra.filter((_: any, j: number) => j !== i))}>Ta bort</Button>}
        </div>
      ))}
      {!m.locked && <Button size="sm" icon="plus" onClick={() => set('extra', [...(v.extra || []), { text: '', antal: 1, apris: '', moms: 25 }])}>Lägg till rad</Button>}
    </Card>
  );
}
function AllaKontroller() {
  const m = useMonth();
  const L = [...m.avvikelser, ...m.R.kontroll].sort((a: any, b: any) => (a.niva === 'fel' ? 0 : 1) - (b.niva === 'fel' ? 0 : 1));
  return (
    <div className="ba-table-wrap"><table className="ba-table"><thead><tr><th>Nivå</th><th>Typ</th><th>Vad</th><th className="n">Belopp</th><th>Åtgärd</th></tr></thead>
      <tbody>{L.map((k: any, i: number) => <tr key={i}><td><Pill tone={k.niva === 'fel' ? 'bad' : 'info'} dot={false}>{k.niva === 'fel' ? 'Åtgärda' : 'Info'}</Pill></td><td>{k.typ}</td><td>{k.vad}</td><td className="n">{k.belopp == null ? '' : kr2(k.belopp)}</td><td className="muted small">{k.atgard}</td></tr>)}</tbody>
    </table></div>
  );
}

// ------------------------------------------------------------------ Steg 3: Godkänn
export function Godkann() {
  const m = useMonth(); const a = useAccount(); const b = useBackend(); const toast = useToast(); const go = useStepNav(); const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const R = m.R;
  if (!R) return <EmptyState title="Inget att godkänna än" action={<Button variant="primary" onClick={() => go('filer')}>Till filerna</Button>}>Dra in TaxiCaller och Bambora först.</EmptyState>;
  const aktiva = R.bolag.filter((x: any) => x.aktiv);
  const devs = [...R.kontroll.filter((k: any) => k.niva === 'fel'), ...m.avvikelser.filter((x: any) => x.niva === 'fel')];
  const okontrollerade = devs.filter(d => !m.marks[devKey(d)]).length;
  const approve = async () => {
    if (m.exempel) { toast('I exempelläget godkänns inget. Gå vidare och titta på publiceringen.'); go('publicera'); return; }
    setBusy(true);
    try { await b.approvePeriod(a.tenant.id, M, m.period); qc.invalidateQueries({ queryKey: ['periods'] }); toast(`${Manad(m.period)} är godkänd och låst.`); go('publicera'); }
    catch (e: any) { toast(e.message, { tone: 'bad' }); }
    setBusy(false);
  };
  const reopen = async () => { setBusy(true); try { await b.reopenPeriod(a.tenant.id, M, m.period); toast('Månaden är öppen igen.'); } catch (e: any) { toast(e.message, { tone: 'bad' }); } setBusy(false); };
  const correction = async () => { setBusy(true); try { await b.reopenForCorrection(a.tenant.id, M, m.period); toast('Rättelsen är påbörjad. Ändra och publicera en ny version med orsak.'); go('filer'); } catch (e: any) { toast(e.message, { tone: 'bad' }); } setBusy(false); };
  return (
    <div className="pf-sidebar-layout--right pf-sidebar-layout">
      <Card title={m.status === 'oppen' ? `Godkänn ${manad(m.period)}` : m.status === 'godkand' ? `${Manad(m.period)} är godkänd` : `${Manad(m.period)} är publicerad`}>
        <dl className="pf-kv">
          <div><dt>Åkare med avräkning</dt><dd>{aktiva.length}</dd></div>
          <div><dt>Att betala till åkare</dt><dd>{krs(-aktiva.filter((x: any) => x.att < 0).reduce((s: number, x: any) => s + x.att, 0))}</dd></div>
          <div><dt>Åkare som betalar in</dt><dd>{krs(aktiva.filter((x: any) => x.att > 0).reduce((s: number, x: any) => s + x.att, 0))}</dd></div>
          <div><dt>Kundfakturor</dt><dd>{krs(R.kpi.kundTotal)}</dd></div>
          <div><dt>Avvikelser kontrollerade</dt><dd>{devs.length - okontrollerade} av {devs.length}</dd></div>
        </dl>
        {m.status === 'oppen' && okontrollerade > 0 && <div style={{ marginTop: 14 }}><Deviation tone="warn" title={`${okontrollerade} ${okontrollerade === 1 ? 'avvikelse är' : 'avvikelser är'} inte markerade som kontrollerade`} text="Du kan godkänna ändå, men titta på dem först." actions={[{ label: 'Till kontroll', onClick: () => go('kontroll') }]} /></div>}
        {m.periodRow?.approved_at && m.status !== 'oppen' && <p className="small muted">Godkänd {String(m.periodRow.approved_at).slice(0, 16).replace('T', ' ')}.</p>}
        <div className="ba-row" style={{ marginTop: 16 }}>
          {m.status === 'oppen' && <Button variant="primary" icon="check" loading={busy} disabled={!a.canApprove} title={a.canApprove ? undefined : 'Din roll får inte godkänna. Se Inställningar, Användare.'} onClick={approve}>Godkänn {manad(m.period)}</Button>}
          {m.status === 'godkand' && <><Button variant="primary" iconRight="arrow" onClick={() => go('publicera')}>Till publicering</Button><Button onClick={reopen} loading={busy}>Öppna igen</Button></>}
          {m.status === 'publicerad' && <Button onClick={correction} loading={busy} icon="pencil">Gör en rättelse</Button>}
        </div>
      </Card>
      <Card tone="subtle" title="Det här händer när du godkänner">
        <ul className="pf-list-plain small" style={{ display: 'grid', gap: 10 }}>
          <li className="ba-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><Icon name="lock" />Månaden låses. Filer och manuella poster kan inte ändras.</li>
          <li className="ba-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><Icon name="send" />Sedan publicerar du till åkarna i nästa steg.</li>
          <li className="ba-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><Icon name="undo" />Fram till publiceringen kan du öppna månaden igen. Efter publicering blir rättelser en ny version med orsak.</li>
        </ul>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Steg 4: Publicera
export function Publicera() {
  const m = useMonth(); const a = useAccount(); const b = useBackend(); const toast = useToast(); const go = useStepNav(); const qc = useQueryClient();
  const net = useNetwork(a.tenant.id, 'avrakning', m.period);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [visaAlla, setVisaAlla] = useState(false);
  const R = m.R;
  const byName = useMemo(() => new Map((net.data || []).map(x => [x.name, x])), [net.data]);
  if (!R) return <EmptyState title="Inget att publicera än" />;
  if (m.status === 'oppen' && !m.exempel) return <EmptyState icon="lock" title={`Godkänn ${manad(m.period)} först`} action={<Button variant="primary" onClick={() => go('godkann')}>Till godkännande</Button>}>Månaden låses när du godkänner. Sedan kan du publicera.</EmptyState>;
  const list = A.publishList(R, m.S, new Set((net.data || []).filter(x => !x.invited).map(x => x.name)));
  const mottagare = list.filter(x => !skip.has(x.namn) && byName.has(x.namn));
  const utbDag = a.tenant.settings?.utbDag || 5;
  const preview = list.find(x => x.att < 0) || list[0];
  const centralKort = a.tenant.name;
  const exempelMeddelande = preview ? (preview.att < 0 ? `${Manad(m.period)} är klar. Du får ${kr2(-preview.att)} kr den ${dagText(ymAdd(m.period, 1) + '-' + String(utbDag).padStart(2, '0'))}.` : `${Manad(m.period)} är klar. Du betalar ${kr2(preview.att)} kr senast den ${dagText(ymAdd(m.period, 1) + '-' + String(utbDag).padStart(2, '0'))}.`) : '';
  const needReason = m.version > 1;
  const publish = async () => {
    if (m.exempel) { toast('I exempelläget skickas inget.'); return; }
    if (needReason && !reason.trim()) { toast('Skriv varför rättelsen görs. Åkarna ser orsaken.', { tone: 'bad' }); return; }
    setBusy(true);
    try {
      const items = R.bolag.filter((x: any) => x.aktiv && !skip.has(x.namn) && byName.has(x.namn)).map((x: any) => {
        const payload = A.buildShare({ R, S: m.S, bolag: x, spec: m.spec?.bolag.find((s: any) => s.namn === x.namn), passager: m.passager || undefined, fran: centralKort, utbDag, version: m.version, orsak: needReason ? reason.trim() : null });
        return { to: byName.get(x.namn).tenant_id, kind: 'akaravrakning', payload, title: `${needReason ? 'Rättad avräkning' : 'Ny avräkning'} från ${centralKort}`, body: payload.meddelande, link: 'min-avrakning/' + m.period };
      });
      const n = await b.publish(a.tenant.id, M, m.period, items, needReason ? reason.trim() : null);
      await b.setDoc(a.tenant.id, M, 'months/' + m.period, { last: true }, { merge: true });
      for (const s of ['forsta-manad', 'publicera']) await b.setGuideStep(a.tenant.id, M, s, true);
      qc.invalidateQueries();
      toast(`${Manad(m.period)} är publicerad till ${n} åkare.`);
    } catch (e: any) { toast(e.message, { tone: 'bad' }); }
    setBusy(false);
  };
  const visma = () => download(`Visma_underlag_${m.period}.xlsx`, writeXlsx(A.excelSheets(R, m.D.forskottRad)));
  const shown = visaAlla ? list : list.slice(0, 8);
  return (
    <div className="pf-sidebar-layout pf-sidebar-layout--right">
      <section>
        <div className="pf-section-h"><h2>{m.status === 'publicerad' ? `Skickad till ${mottagare.length} åkare` : `Skickas till ${mottagare.length} åkare`}</h2><span className="ba-grow" /><span className="small muted">{m.periodRow?.approved_at ? `Godkänd ${String(m.periodRow.approved_at).slice(0, 16).replace('T', ' ')}` : ''}</span></div>
        <div className="ba-table-wrap">
          <table className="ba-table">
            <thead><tr><th>Åkeri</th><th className="n">Belopp</th><th>Riktning</th><th>Hur de får den</th></tr></thead>
            <tbody>{shown.map(x => {
              const t = byName.get(x.namn); const can = !!t;
              return (
                <tr key={x.namn}>
                  <td><label className="ba-check"><input type="checkbox" disabled={!can || m.status === 'publicerad'} checked={can && !skip.has(x.namn)} onChange={e => setSkip(s => { const n = new Set(s); e.target.checked ? n.delete(x.namn) : n.add(x.namn); return n; })} /><b>{x.namn}</b></label></td>
                  <td className="n">{kr2(-x.att)}</td>
                  <td><Pill tone={x.att <= 0 ? 'ok' : 'warn'} dot={false}>{x.att <= 0 ? 'Får' : 'Betalar in'}</Pill></td>
                  <td className="muted">{!can ? 'Saknar konto, bjud in under Åkare' : x.kanal}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        {list.length > 8 && <Button variant="link" onClick={() => setVisaAlla(v => !v)}>{visaAlla ? 'Visa färre' : `+${list.length - 8} åkare till`}</Button>}
        <p className="small muted">Alla får en PDF, raderna per bil och bro och Sturup per passage.</p>
      </section>
      <aside className="ba-stack">
        <Card title="Det här händer när du publicerar">
          <ul className="pf-list-plain small" style={{ display: 'grid', gap: 10 }}>
            <li className="ba-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><Icon name="phone" />Varje åkare får en notis i appen och ett mejl.</li>
            <li className="ba-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><Icon name="wallet" />Åkare med Åkarkassan får avräkning, bro och Sturup inlästa automatiskt.</li>
            <li className="ba-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><Icon name="file" />Underlag för Visma skapas (Excel) för bokföringen.</li>
            <li className="ba-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><Icon name="lock" />Månaden låses. Rättelser blir en ny version med orsak.</li>
          </ul>
        </Card>
        {preview && <Card tone="navy"><div className="small" style={{ opacity: .75 }}>Förhandsvisning hos åkaren</div><div style={{ fontWeight: 700, fontSize: 15.5, margin: '6px 0' }}>"{exempelMeddelande}"</div><div className="small" style={{ opacity: .75 }}>{preview.namn}, notis i appen</div></Card>}
        {needReason && m.status !== 'publicerad' && <label className="ba-field"><span className="ba-label">Orsak till rättelsen</span><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Till exempel: fel pris på bron för bil 112" /></label>}
        {m.status === 'publicerad'
          ? <><Banner tone="info">Publicerad {String(m.periodRow?.published_at || '').slice(0, 16).replace('T', ' ')}, version {m.version}.</Banner><Button icon="download" onClick={visma}>Underlag för Visma (Excel)</Button><Link className="ba-btn" to="/$tenant/akare" params={{ tenant: a.tenant.slug }}>Se vem som har öppnat</Link></>
          : <Button variant="primary" size="lg" icon="send" block loading={busy} disabled={!mottagare.length || !a.canApprove} onClick={publish}>{m.exempel ? 'I exempelläget skickas inget' : `Publicera till ${mottagare.length} åkare`}</Button>}
      </aside>
    </div>
  );
}
export { Tag };

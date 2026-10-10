// Åkarkassan för underkunden (sidan 37 till 40): underlag, lön, kassaredovisning, bro och Sturup,
// personal och avtal (signeras med pennan), körpass, ekonomi, bokföring och inställningar.
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Banner, Button, Card, Checkbox, DropZone, EmptyState, FileRow, Icon, Kpi, Modal, Pill, Segmented, Select, SignaturePad, TextField, useToast, type SignatureHandle } from '@bolagsappar/ui';
import { ingestLdl, recognizeKassan, importPlatt, godkannLon, packP, avText, avSaknas, avStatus, avUpprata, avSignera, avDatum, TP } from '@bolagsappar/core/kassan';
import { rawLines, writeXlsx, HJALPTEXT } from '@bolagsappar/core/filetypes';
import { skattetabellText } from '@bolagsappar/core/testdata';
import { kr0, kr2, krs, manad, manadAr, Manad, ymAdd, pct, initialer, dagText } from '@bolagsappar/core/format';
import { useAccount } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useDocs, useSharesTo } from '../../lib/q';
import { readLocal, download } from '../../lib/files';
import { lonespecPdf, avtalPdf } from '../../lib/pdf';
import { useHelpCtx, usePage, useWelcome } from '../../shell/Help';
import { Loading } from '../../shell/Shell';
import { GEMENSAMT } from '@bolagsappar/guides';
import { useKassa, KM, type Kassa } from './model';

const TABS = [['oversikt', 'Översikt'], ['lon', 'Lön'], ['kassa', 'Kassaredovisning'], ['bro', 'Bro och Sturup'], ['personal', 'Personal'], ['korpass', 'Körpass'], ['ekonomi', 'Ekonomi'], ['bokforing', 'Bokföring och bank'], ['installningar', 'Inställningar']] as const;
const VY: Record<string, string> = { oversikt: 'oversikt', lon: 'lon', kassa: 'kassa', bro: 'bro', personal: 'personal', korpass: 'korpass', ekonomi: 'ekonomi', bokforing: 'bokforing', installningar: 'installningar' };

export function KassanStart() {
  const a = useAccount();
  const sh = useSharesTo(a.tenant.id, 'avrakning');
  if (sh.isLoading) return <Loading />;
  const p = sh.data?.[0]?.period || (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  return <Navigate to="/$tenant/akarkassan/$period/$tab" params={{ tenant: a.tenant.slug, period: p, tab: 'oversikt' }} />;
}

export function Kassan() {
  const a = useAccount(); const nav = useNavigate();
  const { period, tab = 'oversikt' } = useParams({ strict: false }) as { period: string; tab?: string };
  const search = useSearch({ strict: false }) as any; const exempel = !!search.exempel;
  const k = useKassa(period, exempel);
  const help = useHelpCtx();
  useWelcome('kassan', 'sub');
  const steg = [
    { title: 'Underlag', sub: `Centralens filer kommer själv. Ladda upp LDL.`, done: !!k.shifts.length },
    { title: 'Koppla bro och Sturup', sub: 'Vem körde när bilen passerade?', done: !!k.R && k.R.bro.every((p: any) => p.forare) },
    { title: 'Lön', sub: 'Kontrollera och godkänn lönekörningen.', done: !!k.month.lonekorning },
    { title: 'Lönespecar', sub: 'Skickas till förarna i appen.', done: !!k.month.lonekorning }
  ];
  usePage({ crumbs: ['Åkarkassan', Manad(period)], module: 'kassan', variant: 'sub', view: VY[tab] || 'oversikt', steps: tab === 'oversikt' ? steg : undefined, progress: { done: steg.filter(s => s.done).length, total: 4, label: 'Din kom igång' } }, [period, tab, k.shifts.length, !!k.month.lonekorning]);
  if (k.loading) return <Loading />;
  const go = (t: string, p = period) => nav({ to: '/$tenant/akarkassan/$period/$tab', params: { tenant: a.tenant.slug, period: p, tab: t }, search: exempel ? { exempel: 1 } : {} } as any);
  const perioder = [...new Set([...k.shares.map(s => s.period), period])].sort().reverse().slice(0, 6);
  const title = tab === 'personal' ? 'Personal' : manadAr(period);
  return (
    <>
      {exempel && <div style={{ marginBottom: 14 }}><Banner action={<Button size="sm" onClick={() => go(tab)}>Avsluta exempelläget</Button>}>{GEMENSAMT.exempelBanner}</Banner></div>}
      <div className="pf-head">
        <div className="ba-grow"><div className="pf-eyebrow">Åkarkassan</div><h1 className="pf-h1">{title}</h1></div>
        {tab !== 'personal' && perioder.length > 1 && <Select value={period} onChange={e => go(tab, e.target.value)} aria-label="Månad" style={{ width: 170 }}>{perioder.map(p => <option key={p} value={p}>{manadAr(p)}</option>)}</Select>}
        <TabActions k={k} tab={tab} />
      </div>
      <nav className="ba-tabs" role="tablist" style={{ marginBottom: 18 }}>
        {TABS.map(([key, l]) => <Link key={key} to="/$tenant/akarkassan/$period/$tab" params={{ tenant: a.tenant.slug, period, tab: key }} search={exempel ? { exempel: 1 } : {}} aria-current={tab === key ? 'page' : undefined}>{l}{key === 'bro' && k.R && k.R.bro.filter((p: any) => !p.forare).length ? <span className="cnt">{k.R.bro.filter((p: any) => !p.forare).length}</span> : null}</Link>)}
      </nav>
      {tab === 'oversikt' && <Oversikt k={k} go={go} onHelp={() => help.showFile('kassan', 'ldl')} />}
      {tab === 'lon' && <Lon k={k} />}
      {tab === 'kassa' && <Kassaredovisning k={k} />}
      {tab === 'bro' && <BroSturup k={k} />}
      {tab === 'personal' && <Personal k={k} />}
      {tab === 'korpass' && <Korpass k={k} />}
      {tab === 'ekonomi' && <Ekonomi k={k} />}
      {tab === 'bokforing' && <Bokforing k={k} />}
      {tab === 'installningar' && <Inst k={k} />}
    </>
  );
}

function TabActions({ k, tab }: { k: Kassa; tab: string }) {
  if (tab === 'oversikt' || tab === 'kassa' || tab === 'korpass') return <Button icon="download" disabled={!k.R} onClick={() => exportXlsx(k)}>Excel</Button>;
  return null;
}

// ------------------------------------------------------------------ spara
function useSave(k: Kassa) {
  const b = useBackend(); const qc = useQueryClient(); const toast = useToast();
  return async (path: string, data: any, msg?: string, merge = false) => {
    if (k.exempel) { toast('I exempelläget sparas inget.'); return false; }
    try { await b.setDoc(k.t, KM, path, data, { merge }); qc.invalidateQueries({ queryKey: ['documents', k.t, KM] }); if (msg) toast(msg); return true; }
    catch (e: any) { toast(e.message, { tone: 'bad' }); return false; }
  };
}

// ------------------------------------------------------------------ Översikt: månadens underlag (sidan 37)
function Oversikt({ k, go, onHelp }: { k: Kassa; go: (t: string) => void; onHelp: () => void }) {
  const a = useAccount(); const toast = useToast(); const save = useSave(k); const b = useBackend();
  const [pending, setPending] = useState<any>(null);
  const central = a.parent?.name || 'centralen';
  const sh = k.share;
  const nBro = k.fromCentral.bro.filter((p: any) => p.typ === 'bro').length, nStu = k.fromCentral.stu.length;
  const klara = [!!sh, !!sh, !!sh, !!k.month.ldl, !!k.skatt].filter(Boolean).length;
  const onFiles = async (files: File[]) => {
    for (const f of files) {
      try {
        const read = await readLocal(f);
        const rec = recognizeKassan(read, read.rawPages ? rawLines(read.rawPages) : [], k.E);
        if (rec.type === 'ldl') {
          const r = ingestLdl(rec.text, k.settings, k.E);
          if (r.error) { toast(r.error, { tone: 'bad' }); continue; }
          if (r.period !== k.period) { toast(HJALPTEXT.felManad(r.period, k.period), { tone: 'bad' }); continue; }
          setPending({ kind: 'ldl', name: f.name, text: rec.text, r });
        } else if (rec.type === 'skatt') {
          setPending({ kind: 'skatt', name: f.name, tabeller: rec.tabeller });
        } else if (rec.type === 'platt') {
          setPending({ kind: 'platt', name: f.name, src: rec.src, text: rec.text });
        } else if (rec.type === 'bro' || rec.type === 'stu') {
          setPending({ kind: rec.type, name: f.name, rows: rec.type === 'bro' ? rec.bro.rows : rec.stu.rows });
        } else toast(HJALPTEXT.okand(rec.hint, 'kassan'), { tone: 'bad' });
      } catch (e: any) { toast(`Kunde inte läsa ${f.name}: ${e.message}`, { tone: 'bad' }); }
    }
  };
  const confirm = async () => {
    const p = pending; setPending(null);
    if (p.kind === 'ldl') {
      const nyaBilar = { ...(k.settings.bilar || {}), ...p.r.nyaBilar };
      await save('settings', { ...k.settings, bilar: nyaBilar, ...(p.r.foretag && !k.settings.foretagLast ? { foretag: p.r.foretag } : {}) });
      if (await save('m-' + k.period, { ...k.month, ldl: p.text, forare: k.month.forare || {}, overrides: k.month.overrides || {}, files: { ...(k.month.files || {}), ldl: `${p.name}, ${p.r.shifts.length} pass` } }, `Löneunderlaget är inläst${p.r.utanfor ? `, ${p.r.utanfor} pass från annan månad togs bort` : ''}. Lönen är uträknad.`)) go('lon');
    } else if (p.kind === 'skatt') {
      const packed = Object.fromEntries(Object.entries(p.tabeller).map(([n, v]: any) => [n, k.E.packTabell(v)]));
      await save('skatt', { ar: +k.period.slice(0, 4), tabeller: packed }, `Skattetabellerna är inlästa (${Object.keys(packed).length} tabeller).`);
      try { await b.setGuideStep(k.t, KM, 'skatt', true); } catch {}
    } else if (p.kind === 'platt') {
      const ids = [...new Set([...k.shifts.map((s: any) => s.forare), ...Object.keys(k.settings.forare || {})])];
      const r = importPlatt(p.text, p.src, { month: k.month, ids, namnFor: k.namnFor, ENG: k.E });
      if (r.error) { toast(r.error, { tone: 'bad' }); return; }
      await save('m-' + k.period, { ...r.month, files: { ...(k.month.files || {}), [p.src]: `${p.name}, ${r.ok.length} förare` } }, `Plattformsavgift inläst för ${r.ok.length} förare${r.miss.length ? '. Hittade inte: ' + r.miss.join(', ') : ''}.`);
    } else {
      await save('m-' + k.period, { ...k.month, [p.kind]: packP(p.rows), files: { ...(k.month.files || {}), [p.kind]: `${p.name}, ${p.rows.length} rader` } }, `${p.kind === 'bro' ? 'Brofakturan' : 'Sturupfakturan'} är inläst.`);
    }
  };
  const R = k.R;
  return (
    <div className="ba-stack" style={{ gap: 18 }}>
      <DropZone title="Dra in LDL-filen här" text="Löneunderlaget från Megtax, eller skattetabellen och plattformsavgiften. Filerna läses i din webbläsare." onFiles={onFiles} accept=".txt,.csv,.ldl,.pdf,.xlsx" />
      <section>
        <div className="pf-section-h"><span className="pf-marker">1</span><h2>Månadens underlag</h2><span className="ba-grow" /><span className="small muted">{klara} av 5 klara · plattformsavgift är valfri</span></div>
        <div className="ba-stack" style={{ gap: 8 }}>
          <FileRow title={`Avräkning från ${central}`} sub="Kontokort, krediter och avgifter" status={sh ? 'auto' : 'missing'} action={sh ? <><span className="ba-tag">Från {central}</span><span className="small muted">Hämtad {String(sh.created_at).slice(0, 10)}</span></> : <Pill tone="info" dot={false}>Väntar på {central}</Pill>} />
          <FileRow title="Øresundsbron" sub="Bro och CPH per bil" status={sh ? 'auto' : 'missing'} action={sh ? <><span className="ba-tag">Från {central}</span><span className="small muted">{nBro} passager</span></> : <Pill tone="info" dot={false}>Väntar</Pill>} />
          <FileRow title="Sturup, Swedavia" sub="Passager per bil" status={sh ? 'auto' : 'missing'} action={sh ? <><span className="ba-tag">Från {central}</span><span className="small muted">{nStu} passager</span></> : <Pill tone="info" dot={false}>Väntar</Pill>} />
          <FileRow title="Löneunderlag från Megtax (LDL)" sub={k.month.ldl ? k.month.files?.ldl : `1:a ${manad(k.period)} till 1:a ${manad(ymAdd(k.period, 1))}`} status={k.month.ldl || k.exempel ? 'ok' : 'missing'} onHelp={onHelp} action={k.month.ldl ? <Pill tone="ok">Inläst</Pill> : <><span className="small muted">Du laddar upp</span><Button size="sm" variant="primary" onClick={() => document.querySelector<HTMLInputElement>('.ba-drop input[type=file]')?.click()}>Ladda upp</Button></>} />
          <FileRow title="Plattformsavgift Bolt och Uber" sub={k.month.files?.bolt || k.month.files?.uber || 'Om förarna kör via plattformarna'} status={k.month.files?.bolt || k.month.files?.uber ? 'ok' : 'missing'} action={<><span className="small muted">Du laddar upp, valfritt</span><Button size="sm" onClick={() => document.querySelector<HTMLInputElement>('.ba-drop input[type=file]')?.click()}>Ladda upp</Button></>} />
          <FileRow title={`Skattetabell ${k.skattAr || k.period.slice(0, 4)}`} sub="Skatteverkets fil" status={k.skatt ? 'ok' : 'missing'} onHelp={onHelp} action={k.skatt ? <><Pill tone="info" dot={false}>Inläst</Pill><span className="small muted">Tabell {Object.keys(k.skatt).sort()[0]} till {Object.keys(k.skatt).sort().pop()}</span></> : <Button size="sm" onClick={() => document.querySelector<HTMLInputElement>('.ba-drop input[type=file]')?.click()}>Ladda upp</Button>} />
        </div>
        <div className="pf-lock" style={{ marginTop: 12 }}><Icon name="alert" /><span><b>När LDL är inläst</b> räknas lönen ut direkt. Därefter går du till fliken Lön.</span></div>
      </section>
      {R && (
        <section>
          <div className="pf-section-h"><h2>Månaden i siffror</h2></div>
          <div className="ba-grid ba-grid--3">
            <Kpi label="Inkört inkl. moms" value={krs(R.rows.reduce((s: number, r: any) => s + r.ink, 0), false)} sub={krs(R.rows.reduce((s: number, r: any) => s + r.exkl, 0), false) + ' exkl. moms'} />
            <Kpi label="Kontanter i bilarna" value={krs(R.rows.reduce((s: number, r: any) => s + r.kont, 0), false)} sub="redovisas av förarna" />
            <Kpi label="Bruttolön förare" value={krs(R.rows.reduce((s: number, r: any) => s + r.brutto, 0), false)} sub={krs(R.rows.reduce((s: number, r: any) => s + r.agAvg, 0), false) + ' arbetsgivaravgift'} />
          </div>
        </section>
      )}
      {!k.month.ldl && !k.exempel && <Card tone="subtle" title="Exempelfil för demon"><p className="small muted" style={{ marginTop: 0 }}>En påhittad LDL-fil för {manad(k.period)} med era bilar. Ladda ner och dra in den ovan.</p><div className="ba-row"><Button size="sm" icon="download" onClick={() => demoLdl(k)}>LDL från Megtax</Button>{!k.skatt && <Button size="sm" icon="download" onClick={() => download('skattetabeller.txt', skattetabellText())}>Skattetabell</Button>}</div></Card>}
      {pending && (
        <Modal open onClose={() => setPending(null)} title="Det här hittade vi" labelledBy="kp-h" footer={<><Button onClick={() => setPending(null)}>Avbryt</Button><Button variant="primary" icon="check" onClick={confirm}>Spara</Button></>}>
          <div className="small">
            <b>{pending.name}</b>
            <p>{pending.kind === 'ldl' ? `${pending.r.shifts.length} körpass, ${new Set(pending.r.shifts.map((s: any) => s.forare)).size} förare, ${new Set(pending.r.shifts.map((s: any) => s.reg)).size} bilar, ${manadAr(pending.r.period).toLowerCase()}.` : pending.kind === 'skatt' ? `Skattetabeller ${Object.keys(pending.tabeller).sort()[0]} till ${Object.keys(pending.tabeller).sort().pop()}.` : pending.kind === 'platt' ? `Plattformsavgift från ${pending.src === 'uber' ? 'Uber' : 'Bolt'}.` : `${pending.rows.length} passager.`}</p>
            {pending.kind === 'ldl' && pending.r.utanfor > 0 && <p className="muted">{pending.r.utanfor} pass från annan månad tas bort.</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}

function demoLdl(k: Kassa) {
  const regs = (k.share?.payload?.perBil || []).map((x: any) => [String(x.bil), x.reg.slice(0, 3) + ' ' + x.reg.slice(3)]);
  const bilar = (regs.length ? regs : [['901', 'QAB 12D']]).slice(0, 2);
  const ids = Object.keys(k.settings.forare || {}); const f = ids.length >= 4 ? ids : ['100001', '100002', '100003', '100004'];
  import('@bolagsappar/core/testdata').then(T => download(`LDL_${k.period}.txt`, T.ldlText({ period: k.period, bilar, forare: [[f[0], f[1]], [f[2], f[3]]].slice(0, bilar.length), foretag: k.settings.foretag?.toUpperCase() || 'EXEMPEL AB', seed: +k.period.slice(5) * 7, skippa: 0.35 }), 'text/plain'));
}

// ------------------------------------------------------------------ Lön (sidan 38)
function Lon({ k }: { k: Kassa }) {
  const a = useAccount(); const toast = useToast(); const save = useSave(k); const b = useBackend();
  const [visa, setVisa] = useState<any>(null);
  const [bekrafta, setBekrafta] = useState(false);
  if (!k.R) return <EmptyState icon="upload" title="Ingen lön än" action={<Link className="ba-btn ba-btn--primary" to="/$tenant/akarkassan/$period/$tab" params={{ tenant: a.tenant.slug, period: k.period, tab: 'oversikt' }}>Ladda upp LDL</Link>}>Dra in LDL-filen från Megtax under Översikt så räknas lönen ut direkt.</EmptyState>;
  const LS = k.LS, lk = k.month.lonekorning;
  const brutto = LS.reduce((s: number, x: any) => s + x.L.brutto, 0), skatt = LS.reduce((s: number, x: any) => s + x.L.skatt, 0), ag = LS.reduce((s: number, x: any) => s + x.L.ag.belopp, 0), kont = LS.reduce((s: number, x: any) => s + (x.r.kontant || 0), 0);
  const tim = k.R.rows.reduce((s: number, r: any) => s + r.tim, 0);
  const skattDag = ymAdd(k.utbMan, 1) + '-12';
  const klara = LS.filter((x: any) => !x.L.fel.length);
  const godkann = async () => {
    const g = godkannLon(klara, { period: k.period, c: k.R.cfg, lonHist: k.settings.lonHist || {} });
    if (await save('m-' + k.period, { ...k.month, lonekorning: g.lonekorning })) {
      await save('settings', { ...k.settings, lonHist: g.lonHist });
      try { await b.setGuideStep(k.t, KM, 'forsta-lon', true); } catch {}
      toast(`Lönekörningen är godkänd och låst. ${klara.length} förare får sin lönespec i appen.`);
    }
    setBekrafta(false);
  };
  const pdfAlla = () => LS.forEach((x: any) => download(`Lonespec_${k.period}_${x.r.id}.pdf`, lonespecPdf({ L: x.L, namn: k.namnFor(x.r.id), id: x.r.id, foretag: k.settings.foretag || a.tenant.name, period: k.period, utb: k.utbDatum })));
  return (
    <>
      <div className="ba-row" style={{ justifyContent: 'flex-end', marginTop: -6, marginBottom: 14 }}>
        <Button icon="file" onClick={pdfAlla}>Lönespecar som PDF</Button>
        {lk ? <Pill tone="ok">Godkänd {lk.datum}</Pill> : <Button variant="primary" icon="check" onClick={() => setBekrafta(true)} disabled={!klara.length}>Godkänn lönekörningen</Button>}
      </div>
      <section>
        <div className="ba-grid ba-grid--4">
          <Kpi label="Bruttolön förare" value={krs(brutto)} sub={`${LS.length} förare, ${kr0(tim)} timmar`} />
          <Kpi label="Skatt att betala in" value={krs(skatt)} sub={`senast ${dagText(skattDag)}`} subTone="warn" />
          <Kpi label="Arbetsgivaravgift" value={krs(ag)} sub={pct(k.cfg.agAvgift, 2)} />
          <Kpi label="Kontanter kvittade" value={krs(kont)} sub="från kassaredovisningen" />
        </div>
      </section>
      <div className="ba-table-wrap pf-section">
        <table className="ba-table">
          <thead><tr><th>Förare</th><th className="n">Timmar</th><th className="n">Inkört exkl. moms</th><th className="n">Bruttolön</th><th className="n">Skatt</th><th className="n">Kvittat</th><th className="n">Att utbetala</th><th>Status</th></tr></thead>
          <tbody>{LS.map(({ r, L }: any) => (
            <tr key={r.id} className="click" onClick={() => setVisa({ r, L })}>
              <td className="b">{k.namnFor(r.id) || 'Förare ' + r.id}<div className="small muted">{r.id}</div></td>
              <td className="n">{kr0(r.tim)}</td><td className="n">{kr2(r.exkl)}</td><td className="n">{kr2(L.brutto)}</td><td className="n">{kr2(-L.skatt)}</td><td className="n">{kr2(-(r.kontant || 0))}</td><td className="n strong">{kr2(L.netto)}</td>
              <td>{L.fel.length ? <Pill tone="warn">{L.fel[0]}</Pill> : <Pill tone="ok">Klar</Pill>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="pf-lock" style={{ marginTop: 12 }}><Icon name="question" /><span><b>Så räknas lönen.</b> Procentlön på inkört exkl. moms efter plattformsavgift, plus semesterersättning och bonus, minus bro och Sturup enligt era inställningar. Skatt enligt tabell eller jämkning. Klicka på en förare för hela uträkningen rad för rad.</span></div>
      <Modal open={!!visa} onClose={() => setVisa(null)} wide title={visa ? `${k.namnFor(visa.r.id) || 'Förare ' + visa.r.id}, ${manadAr(k.period).toLowerCase()}` : ''} labelledBy="ls-h" footer={<><Button icon="download" onClick={() => download(`Lonespec_${k.period}_${visa.r.id}.pdf`, lonespecPdf({ L: visa.L, namn: k.namnFor(visa.r.id), id: visa.r.id, foretag: k.settings.foretag || a.tenant.name, period: k.period, utb: k.utbDatum }))}>PDF</Button><Button onClick={() => setVisa(null)}>Stäng</Button></>}>
        {visa && <>
          {visa.L.fel.length > 0 && <div style={{ marginBottom: 10 }}><Banner>{visa.L.fel.join('. ')}. Fyll i under Personal.</Banner></div>}
          <div className="ba-table-wrap"><table className="ba-table"><thead><tr><th>Kod</th><th>Text</th><th className="n">Antal</th><th className="n">À-pris</th><th className="n">Belopp</th></tr></thead>
            <tbody>{visa.L.rader.map((x: any, i: number) => <tr key={i} style={x.info ? { color: 'var(--muted)' } : undefined}><td className="num">{x.kod}</td><td>{x.text}{x.info ? ' (info)' : ''}</td><td className="n">{String(x.antal).replace('.', ',')}</td><td className="n">{kr2(x.apris)}</td><td className="n">{kr2(x.belopp)}</td></tr>)}</tbody>
            <tfoot><tr><td colSpan={4}>Bruttolön {kr2(visa.L.brutto)} · skatt {kr2(-visa.L.skatt)} · arbetsgivaravgift {kr2(visa.L.ag.belopp)} ({visa.L.ag.sats})</td><td className="n">{kr2(visa.L.netto)}</td></tr></tfoot></table></div>
          <p className="small muted">Utbetalas {k.utbDatum}. Hittills i år: bruttolön {kr2(visa.L.ytd.lon)}, skatt {kr2(visa.L.ytd.skatt)}.</p>
        </>}
      </Modal>
      <Modal open={bekrafta} onClose={() => setBekrafta(false)} title="Godkänn lönekörningen" labelledBy="gl-h" footer={<><Button onClick={() => setBekrafta(false)}>Avbryt</Button><Button variant="primary" icon="check" onClick={godkann}>Godkänn {klara.length} förare</Button></>}>
        <p className="small" style={{ marginTop: 0 }}>Lönen för {manad(k.period)} låses och betalas ut {k.utbDatum}. Förarna får sin lönespec i appen.</p>
        {LS.length > klara.length && <Banner>{LS.length - klara.length} förare saknar uppgifter och kommer inte med: {LS.filter((x: any) => x.L.fel.length).map((x: any) => (k.namnFor(x.r.id) || x.r.id) + ' (' + x.L.fel.join(', ').toLowerCase() + ')').join('; ')}.</Banner>}
      </Modal>
    </>
  );
}

// ------------------------------------------------------------------ Kassaredovisning
function Kassaredovisning({ k }: { k: Kassa }) {
  const regs = k.R ? Object.keys(k.R.bilar).sort() : [];
  const [bil, setBil] = useState<string>('');
  if (!k.R) return <EmptyState icon="upload" title="Ingen kassaredovisning än">Den skapas när LDL är inläst.</EmptyState>;
  const b = k.R.bilar[bil || regs[0]];
  const andel = 100 - k.cfg.redovForarandel;
  const days = Object.values(b.dagar).sort((x: any, y: any) => x.datum.localeCompare(y.datum)) as any[];
  const tot = (key: string) => days.reduce((s, d) => s + (d.dag?.[key] || 0) + (d.natt?.[key] || 0), 0);
  const cell = (x: any) => x ? [x.kassa, x.kont, x.kred, x.bro, x.stu, x.andel, x.hosForare] : [null, null, null, null, null, null, null];
  const WD = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
  return (
    <>
      <div className="ba-row" style={{ marginBottom: 12 }}><Segmented label="Bil" value={bil || regs[0]} onChange={setBil} options={regs.map(r => ({ value: r, label: k.R.bilar[r].regnr }))} /></div>
      <div className="ba-grid ba-grid--4" style={{ marginBottom: 14 }}>
        <Kpi label="Kassa" value={krs(tot('kassa'), false)} /><Kpi label="Kredit" value={krs(tot('kred'), false)} /><Kpi label="Kastrup och bro" value={krs(tot('bro'), false)} /><Kpi label="Hos förare, netto" value={krs(tot('hosForare'), false)} sub="kontanter att lämna in" />
      </div>
      <div className="ba-table-wrap">
        <table className="ba-table">
          <thead><tr><th rowSpan={2}>Datum</th><th colSpan={7} style={{ textAlign: 'center' }}>Dagpass</th><th colSpan={7} style={{ textAlign: 'center' }}>Kvällspass</th></tr>
            <tr>{[0, 1].flatMap(g => ['Kassa', 'Kontant', 'Kredit', 'Kastrup', 'Sturup', andel + ' %', 'Hos förare'].map(h => <th key={g + h} className="n">{h}</th>))}</tr></thead>
          <tbody>{days.map(d => <tr key={d.datum}><td className="small">{WD[d.wd]} {d.datum.slice(8)}/{+d.datum.slice(5, 7)}</td>{[...cell(d.dag), ...cell(d.natt)].map((v, i) => <td key={i} className="n" style={v != null && v < 0 ? { color: 'var(--bad)' } : undefined}>{v ? kr0(v) : ''}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className="small muted">Samma uppställning som redovisningsmallen. {andel} % av kassan exkl. bro och Sturup är bolagets andel. Hos förare är bolagets andel plus Kastrup och Sturup minus kredit, alltså de kontanter föraren ska lämna in. Negativt belopp betyder att bolaget är skyldigt föraren.</p>
    </>
  );
}

// ------------------------------------------------------------------ Bro och Sturup (sidan 39)
function BroSturup({ k }: { k: Kassa }) {
  const save = useSave(k);
  const [vis, setVis] = useState<'behover' | 'alla'>('behover');
  const [per, setPer] = useState<'bil' | 'forare'>('bil');
  const [ov, setOv] = useState<Record<string, string>>({});
  if (!k.R) return <EmptyState icon="link" title="Inga pass att koppla mot">Ladda upp LDL först. Passagerna från centralen kopplas då till förarnas pass.</EmptyState>;
  const P = k.R.bro;
  const auto = P.filter((p: any) => p.metod === 'pass' || p.metod === 'marginal').length;
  const behover = P.filter((p: any) => !p.forare || p.metod === 'manuell');
  const L = (vis === 'behover' ? behover : P).slice().sort((x: any, y: any) => per === 'bil' ? x.reg.localeCompare(y.reg) || x.ts.localeCompare(y.ts) : String(x.forare || 'ö').localeCompare(String(y.forare || 'ö')) || x.ts.localeCompare(y.ts));
  const forare = [...new Set(k.shifts.map((s: any) => s.forare))] as string[];
  const spara = async () => { await save('m-' + k.period, { ...k.month, overrides: { ...(k.month.overrides || {}), ...ov } }, 'Kopplingarna är sparade.'); setOv({}); };
  const regTxt = (r: string) => r.slice(0, 3) + ' ' + r.slice(3);
  return (
    <>
      <div className="ba-row" style={{ justifyContent: 'flex-end', marginTop: -6, marginBottom: 14 }}><Button variant="primary" onClick={spara} disabled={!Object.keys(ov).length}>Spara kopplingar</Button></div>
      <div className="pf-sidebar-layout">
        <aside className="ba-stack">
          <Card><div className="ba-kpi__label">Passager i {manad(k.period)}</div><div className="ba-kpi__value">{P.length}</div><div className="ba-progress" style={{ margin: '10px 0 6px' }}><span style={{ width: (auto / (P.length || 1) * 100) + '%' }} /></div><div className="small muted">{auto} kopplade automatiskt till ett pass</div></Card>
          <Card tone="subtle"><b className="small">{behover.length} passager behöver dig</b><p className="small muted" style={{ margin: '6px 0 0' }}>Plattformen kopplar en passage till föraren som körde bilen vid tiden. När ingen körde, eller passet nyss slutat, väljer du själv.</p></Card>
          <Card><b className="small">Avdrag på lön</b><p className="small muted" style={{ margin: '6px 0 0' }}>Enligt inställningar: bro dras med {k.cfg.broAndel} %, Sturup {k.cfg.inklSturup ? 'dras' : 'dras inte'}, CPH {k.cfg.inklPickup ? 'dras' : 'dras inte'}.</p></Card>
        </aside>
        <section>
          <div className="pf-filters" style={{ marginTop: 0 }}>
            <Segmented label="Visa" value={vis} onChange={setVis} options={[{ value: 'behover', label: `Behöver förare ${behover.length}` }, { value: 'alla', label: 'Alla' }]} />
            <Segmented label="Sortera" value={per} onChange={setPer} options={[{ value: 'bil', label: 'Per bil' }, { value: 'forare', label: 'Per förare' }]} />
          </div>
          {!L.length ? <EmptyState icon="check" title="Allt är kopplat">Alla passager har en förare.</EmptyState> : (
            <div className="ba-table-wrap"><table className="ba-table">
              <thead><tr><th>Bil</th><th>Tid</th><th>Passage</th><th>Förare</th><th>Koppling</th></tr></thead>
              <tbody>{L.slice(0, 300).map((p: any) => {
                const v = ov[p.key] ?? (p.metod === 'manuell' ? p.forare : '');
                return (
                  <tr key={p.key}>
                    <td className="num b">{regTxt(p.reg)}</td><td className="num">{p.ts.slice(8, 10)}/{+p.ts.slice(5, 7)} {p.ts.slice(11, 16)}</td><td className="small">{p.desc}</td>
                    <td>{p.forare && p.metod !== 'manuell' && !(p.key in ov) ? <b>{k.namnFor(p.forare) || 'Förare ' + p.forare}</b> : <Select value={v || ''} onChange={e => setOv({ ...ov, [p.key]: e.target.value })} aria-label="Välj förare" style={{ height: 34, width: 160 }}><option value="">Välj förare</option>{forare.map(f => <option key={f} value={f}>{k.namnFor(f) || 'Förare ' + f}</option>)}</Select>}</td>
                    <td>{p.metod === 'pass' ? <Pill tone="ok" dot={false}>Inom passet</Pill> : p.metod === 'marginal' ? <Pill tone="ok" dot={false}>Nära passet</Pill> : p.metod === 'manuell' ? <Pill tone="info" dot={false}>Vald manuellt</Pill> : p.forslag ? <Pill tone="warn" dot={false}>Nära passet, {k.namnFor(p.forslag.forare) || p.forslag.forare} slutade {String(p.forslag.slut).slice(11, 16)}</Pill> : <Pill tone="bad" dot={false}>Inget pass i bilen</Pill>}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </section>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Personal och avtal (sidan 40). Signering med pennan.
function Personal({ k }: { k: Kassa }) {
  const a = useAccount(); const save = useSave(k); const toast = useToast(); const b = useBackend();
  const docs = useDocs<any>(k.t, KM, '');
  const avtal = (id: string) => docs.data?.find(d => d.id === 'avtal-' + id)?.data || { versioner: [] };
  const ids = [...new Set([...Object.keys(k.settings.forare || {}), ...k.shifts.map((s: any) => s.forare)])].sort((x, y) => (k.namnFor(x) || 'ö' + x).localeCompare(k.namnFor(y) || 'ö' + y, 'sv'));
  const [val, setVal] = useState<string | null>(null);
  const [ny, setNy] = useState(false);
  const [redigera, setRedigera] = useState<string | null>(null);
  const valt = val || ids.find(id => avStatus(avtal(id)) !== 'signerat') || ids[0];
  const ctx = { settings: k.settings, cfg: k.cfg, central: a.parent ? (a.parent.name.match(/AB$/) ? a.parent.name : a.parent.name + ' AB') : 'centralen', ort: a.parent?.settings?.ort || 'Malmö' };
  const anst = (f: any) => ({ tills: 'Tillsvidare', prov: 'Provanställning', sava: 'Särskild visstid', behov: 'Vid behov' } as any)[f?.anstForm] ? `${({ tills: 'Tillsvidare', prov: 'Provanställning', sava: 'Särskild visstid', behov: 'Vid behov' } as any)[f.anstForm]}${f.anstForm === 'prov' && f.slut ? ' till ' + f.slut : ''}, ${f.omfattning || 'heltid'}` : '';
  return (
    <>
      <div className="ba-row" style={{ justifyContent: 'flex-end', marginTop: -6, marginBottom: 14 }}><Button variant="primary" icon="plus" onClick={() => setNy(true)}>Lägg till förare</Button></div>
      <div className="pf-sidebar-layout pf-sidebar-layout--right">
        <div className="ba-table-wrap">
          <table className="ba-table">
            <thead><tr><th>Förare</th><th>Anställning</th><th>Anställningsavtal</th><th>Uppgifter</th><th /></tr></thead>
            <tbody>{ids.map(id => {
              const f = k.settings.forare?.[id]; const st = avStatus(avtal(id)); const v = avtal(id).versioner.slice(-1)[0];
              const sak = [!f?.person?.personnr && 'Saknar personnummer', !f?.person?.bank && 'Saknar bankkonto'].filter(Boolean) as string[];
              return (
                <tr key={id} className={valt === id ? 'hl' : ''}>
                  <td style={{ whiteSpace: 'nowrap' }}><div className="ba-who"><Avatar size="sm" round text={avText2(f?.namn, id)} /><div><b>{f?.namn || 'Förare ' + id}</b><small>nr {id}</small></div></div></td>
                  <td className="small">{anst(f) || <span className="muted">Saknas</span>}</td>
                  <td>{st === 'signerat' ? <Pill tone="ok">Avtal signerat</Pill> : st === 'utkast' ? <Pill tone="warn">{v?.sign?.anst ? 'Väntar på arbetsgivaren' : 'Väntar på förarens signatur'}</Pill> : <Pill tone="bad">Avtal saknas</Pill>}</td>
                  <td>{sak.length ? <Pill tone="warn" dot={false}>{sak[0]}</Pill> : <Pill tone="ok" dot={false}>Komplett</Pill>}</td>
                  <td><div className="ba-row" style={{ gap: 4, flexWrap: 'nowrap' }}><Button size="sm" variant="link" onClick={() => setVal(id)}>Öppna</Button><Button size="sm" variant="link" onClick={() => setRedigera(id)}>Ändra</Button></div></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        {valt && <AvtalPanel id={valt} k={k} ctx={ctx} doc={avtal(valt)} onSaved={() => docs.refetch()} />}
      </div>
      {(ny || redigera) && <ForareForm k={k} id={redigera} onClose={() => { setNy(false); setRedigera(null); }} onSave={async (id, f) => { const ok = await save('settings', { ...k.settings, forare: { ...(k.settings.forare || {}), [id]: f } }, 'Föraren är sparad.'); if (ok) { try { await b.setGuideStep(k.t, KM, 'forare', true); } catch {} setNy(false); setRedigera(null); } }} />}
    </>
  );
}

function AvtalPanel({ id, k, ctx, doc, onSaved }: { id: string; k: Kassa; ctx: any; doc: any; onSaved: () => void }) {
  const a = useAccount(); const save = useSave(k); const toast = useToast();
  const f = k.settings.forare?.[id] || {};
  const v = doc.versioner[doc.versioner.length - 1];
  const signed = v?.sign?.anst && v?.sign?.arbg;
  const [visa, setVisa] = useState(false);
  const [sign, setSign] = useState<null | 'anst' | 'arbg'>(null);
  const sak = avSaknas(id, k.settings);
  const upprata = async () => { const nv = await avUpprata(id, ctx); if (await save('avtal-' + id, { versioner: [...doc.versioner, nv] }, 'Avtalet är upprättat och låst för signering. Föraren signerar med pennan i appen.')) onSaved(); };
  const steg = !v || signed ? null : !v.sign.anst ? 1 : 2;
  return (
    <aside className="ba-card ba-card--pad" style={{ alignSelf: 'start' }}>
      <div className="ba-row" style={{ marginBottom: 10 }}><b style={{ fontSize: 15 }}>Anställningsavtal, {f.namn || 'Förare ' + id}</b><span className="ba-grow" />{steg && <Pill tone="warn" dot={false}>Steg {steg} av 2</Pill>}{signed && <Pill tone="ok">Signerat</Pill>}</div>
      <dl className="pf-kv" style={{ fontSize: 12.5 }}>
        <div><dt>Anställningsform</dt><dd style={{ fontFamily: 'var(--font)', fontWeight: 600 }}>{({ tills: 'Tillsvidare', prov: 'Provanställning', sava: 'Särskild visstid', behov: 'Vid behov' } as any)[f.anstForm] || 'Saknas'}</dd></div>
        <div><dt>Omfattning</dt><dd style={{ fontFamily: 'var(--font)', fontWeight: 600 }}>{f.omfattning === 'deltid' ? 'Deltid' : 'Heltid'}</dd></div>
        <div><dt>Lön</dt><dd style={{ fontFamily: 'var(--font)', fontWeight: 600 }}>{f.modell === 'fast' ? `Månadslön ${kr0(f.manadslon)} kr` : `Procentlön ${k.cfg.procent} %`}</dd></div>
        <div><dt>Plattformsavgift</dt><dd style={{ fontFamily: 'var(--font)', fontWeight: 600 }}>Avdrag från underlaget</dd></div>
      </dl>
      {sak.length > 0 && !v && <div style={{ marginTop: 12 }}><Banner>Uppgifter saknas: {sak.join(', ')}. Fyll i innan avtalet upprättas.</Banner></div>}
      {v && <div className="ba-sig" style={{ marginTop: 14, textAlign: 'center' }}>
        {signed ? <div className="ba-row" style={{ justifyContent: 'center' }}><img src={v.sign.anst.png} alt={'Underskrift ' + v.sign.anst.namn} style={{ height: 40 }} /><img src={v.sign.arbg.png} alt={'Underskrift ' + v.sign.arbg.namn} style={{ height: 40 }} /></div>
          : <><Icon name="pencil" /><div className="small muted" style={{ marginTop: 4 }}>{steg === 1 ? 'Föraren signerar med pennan i appen' : 'Föraren har signerat. Nu signerar arbetsgivaren.'}</div></>}
      </div>}
      <div className="ba-row" style={{ marginTop: 14 }}>
        {!v || (signed && doc.ny) ? <Button variant="dark" icon="file" disabled={sak.length > 0} onClick={upprata}>Upprätta avtalet</Button>
          : !signed ? <>{steg === 1 && <Button variant="dark" icon="send" onClick={() => toast(`${f.namn || 'Föraren'} ser avtalet under Avtal i appen och signerar med pennan.`)}>Skicka till föraren</Button>}<Button icon="pencil" onClick={() => setSign(steg === 1 ? 'anst' : 'arbg')}>{steg === 1 ? 'Föraren signerar här' : 'Signera som arbetsgivare'}</Button></>
          : <Button variant="dark" icon="download" onClick={() => download(`Anstallningsavtal_${(f.namn || id).replace(/\s+/g, '_')}.pdf`, avtalPdf({ v, namn: f.namn || id, foretag: k.settings.foretag || a.tenant.name, orgnr: k.settings.bolag?.orgnr, rubrik: 'Anställningsavtal' }))}>Signerat avtal (PDF)</Button>}
        <Button onClick={() => setVisa(true)}>Förhandsgranska</Button>
      </div>
      {signed && <p className="small muted" style={{ marginBottom: 0 }}>Kontrollsumma SHA-256 {v.hash.slice(0, 16)}… Texten kan inte ändras efter signering.</p>}
      <Modal open={visa} onClose={() => setVisa(false)} wide title={`Anställningsavtal, ${f.namn || id}`} labelledBy="av-h" footer={<Button onClick={() => setVisa(false)}>Stäng</Button>}>
        <AvtalText text={v ? v.text : avText(id, ctx)} />
      </Modal>
      {sign && <SigneraDialog role={sign} v={v} namn={sign === 'anst' ? f.namn : k.settings.bolag?.firmatecknare || ''} titel={sign === 'anst' ? 'Arbetstagarens underskrift' : 'Arbetsgivarens underskrift, ' + (k.settings.foretag || a.tenant.name)} onClose={() => setSign(null)} onDone={async nv => { const L = [...doc.versioner]; L[L.length - 1] = nv; if (await save('avtal-' + id, { versioner: L }, sign === 'anst' ? 'Arbetstagaren har signerat.' : 'Avtalet är signerat av båda parter.')) { if (sign === 'arbg') { await save('settings', { ...k.settings, bolag: { ...(k.settings.bolag || {}), firmatecknare: nv.sign.arbg.namn } }); } onSaved(); setSign(null); } }} />}
    </aside>
  );
}

export function AvtalText({ text }: { text: any[] }) {
  return <div className="small" style={{ display: 'grid', gap: 12, maxHeight: '60vh', overflow: 'auto' }}>{text.map((s: any, i: number) => <section key={i}><b>{i + 1}. {s.h}</b>{s.p.map((p: string, j: number) => <p key={j} style={{ margin: '4px 0' }}>{p}</p>)}</section>)}</div>;
}

/** Signera med pennan (rita eller skriv namnet). Ingen BankID. */
export function SigneraDialog({ role, v, namn: namn0, titel, onClose, onDone }: { role: 'anst' | 'arbg'; v: any; namn: string; titel: string; onClose: () => void; onDone: (v: any) => Promise<void> }) {
  const toast = useToast();
  const [sig, setSig] = useState<SignatureHandle | null>(null);
  const [namn, setNamn] = useState(namn0 || '');
  const [ort, setOrt] = useState('Malmö');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!ok) { toast('Bekräfta rutan först.', { tone: 'bad' }); return; }
    if (!sig?.isDirty() || !namn.trim()) { toast('Underskrift och namn krävs.', { tone: 'bad' }); return; }
    setBusy(true);
    try { await onDone(await avSignera(v, role, { namn, ort, png: sig.png(), ua: navigator.userAgent })); } catch (e: any) { toast(e.message, { tone: 'bad' }); }
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} wide title={role === 'anst' ? 'Steg 1 av 2: arbetstagaren signerar' : 'Steg 2 av 2: arbetsgivaren signerar'} labelledBy="sig-h" footer={<><Button onClick={onClose}>Avbryt</Button><Button variant="primary" icon="pencil" loading={busy} onClick={go}>Signera</Button></>}>
      <div className="ba-stack">
        <details><summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Läs avtalet</summary><div style={{ marginTop: 8 }}><AvtalText text={v.text} /></div></details>
        <SignaturePad label={titel} handleRef={setSig} />
        <div className="ba-grid ba-grid--2"><TextField label="Namnförtydligande" value={namn} onChange={e => setNamn(e.target.value)} /><TextField label="Ort" value={ort} onChange={e => setOrt(e.target.value)} /></div>
        <Checkbox label={role === 'anst' ? 'Jag har läst avtalet och godkänner villkoren.' : 'Jag har behörighet att teckna avtalet för bolaget.'} checked={ok} onChange={e => setOk(e.target.checked)} />
      </div>
    </Modal>
  );
}

function ForareForm({ k, id, onClose, onSave }: { k: Kassa; id: string | null; onClose: () => void; onSave: (id: string, f: any) => void }) {
  const f0 = id ? k.settings.forare?.[id] || {} : {};
  const [nr, setNr] = useState(id || '');
  const [f, setF] = useState<any>({ namn: '', anstForm: 'tills', omfattning: 'heltid', modell: 'procent', start: '', slut: '', manadslon: '', ...f0, person: { personnr: '', adress: '', postadress: '', bank: '', tabell: 33, ...(f0.person || {}) } });
  const set = (k2: string, v: any) => setF({ ...f, [k2]: v }); const setP = (k2: string, v: any) => setF({ ...f, person: { ...f.person, [k2]: v } });
  return (
    <Modal open onClose={onClose} wide title={id ? `Ändra ${f.namn || 'förare'}` : 'Lägg till förare'} labelledBy="ff-h" footer={<><Button onClick={onClose}>Avbryt</Button><Button variant="primary" icon="check" onClick={() => { if (!nr.trim() || !f.namn.trim()) return; onSave(nr.trim(), f); }}>Spara</Button></>}>
      <div className="ba-grid ba-grid--2">
        <TextField label="Förarnummer i Megtax" mono value={nr} disabled={!!id} onChange={e => setNr(e.target.value)} />
        <TextField label="Namn" value={f.namn} onChange={e => set('namn', e.target.value)} />
        <TextField label="Personnummer" mono value={f.person.personnr} onChange={e => setP('personnr', e.target.value)} placeholder="ÅÅÅÅMMDD-XXXX" />
        <TextField label="Bankkonto" mono value={f.person.bank || ''} onChange={e => setP('bank', e.target.value)} placeholder="Clearing och kontonummer" />
        <TextField label="Adress" value={f.person.adress || ''} onChange={e => setP('adress', e.target.value)} />
        <TextField label="Postnummer och ort" value={f.person.postadress || ''} onChange={e => setP('postadress', e.target.value)} />
        <label className="ba-field"><span className="ba-label">Anställningsform</span><Select value={f.anstForm} onChange={e => set('anstForm', e.target.value)}><option value="tills">Tillsvidare</option><option value="prov">Provanställning</option><option value="sava">Särskild visstid</option><option value="behov">Vid behov</option></Select></label>
        <label className="ba-field"><span className="ba-label">Omfattning</span><Select value={f.omfattning} onChange={e => set('omfattning', e.target.value)}><option value="heltid">Heltid</option><option value="deltid">Deltid</option></Select></label>
        <TextField label="Anställd från" type="date" value={f.start || ''} onChange={e => set('start', e.target.value)} />
        <TextField label="Till och med" type="date" value={f.slut || ''} onChange={e => set('slut', e.target.value)} hint="För provanställning och visstid" />
        <label className="ba-field"><span className="ba-label">Lön</span><Select value={f.modell} onChange={e => set('modell', e.target.value)}><option value="procent">Procentlön</option><option value="fast">Fast månadslön</option></Select></label>
        {f.modell === 'fast' ? <TextField label="Månadslön (kr)" mono value={f.manadslon} onChange={e => set('manadslon', +e.target.value || '')} /> : <TextField label="Skattetabell" mono value={f.person.tabell} onChange={e => setP('tabell', +e.target.value || 33)} />}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Körpass, Ekonomi, Bokföring, Inställningar
function Korpass({ k }: { k: Kassa }) {
  if (!k.shifts.length) return <EmptyState icon="upload" title="Inga körpass">Alla pass från LDL-filen visas här.</EmptyState>;
  return (
    <div className="ba-table-wrap"><table className="ba-table">
      <thead><tr><th>Start</th><th>Slut</th><th>Förare</th><th>Bil</th><th className="n">Timmar</th><th className="n">Turer</th><th className="n">Kontant</th><th className="n">Kredit</th></tr></thead>
      <tbody>{k.shifts.slice().sort((a: any, b: any) => a.a - b.a).map((s: any) => <tr key={s.id}><td className="num small">{s.start}</td><td className="num small">{s.slut}</td><td>{k.namnFor(s.forare) || s.forare}</td><td className="num">{s.regnr}</td><td className="n">{kr2(s.tim)}</td><td className="n">{s.turer}</td><td className="n">{kr0(s.kont)}</td><td className="n">{kr0(s.kred)}</td></tr>)}</tbody>
    </table></div>
  );
}
function Ekonomi({ k }: { k: Kassa }) {
  const a = useAccount();
  const docs = useDocs<any>(k.t, KM, '');
  const rows = useMemo(() => k.shares.slice(0, 6).map(s => {
    const m = docs.data?.find(d => d.id === 'm-' + s.period)?.data; const lk = m?.lonekorning;
    const brutto = lk ? Object.values(lk.rader).reduce((x: number, r: any) => x + r.brutto, 0) : null, ag = lk ? Object.values(lk.rader).reduce((x: number, r: any) => x + r.ag, 0) : null;
    const intakt = s.payload.sammanfattning.find((x: any) => x.key === 'intakt')?.belopp || 0;
    const centralen = -s.payload.sammanfattning.filter((x: any) => x.key !== 'intakt').reduce((x: number, r: any) => x + r.belopp, 0);
    return { p: s.period, intakt, centralen, brutto, ag, att: -s.payload.att, res: brutto == null ? null : intakt - centralen - brutto - (ag || 0) };
  }), [k.shares, docs.data]);
  return (
    <>
      <p className="small muted" style={{ marginTop: 0 }}>Översikt per månad från avräkningen och lönekörningarna. Bränsle, försäkring och andra kostnader läggs in i bokföringen.</p>
      <div className="ba-table-wrap"><table className="ba-table">
        <thead><tr><th>Månad</th><th className="n">Intäkt via {a.parent?.name}</th><th className="n">Avgifter och avdrag</th><th className="n">Bruttolöner</th><th className="n">Arbetsgivaravgift</th><th className="n">Resultat före övriga kostnader</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.p}><td>{manadAr(r.p)}</td><td className="n">{kr0(r.intakt)}</td><td className="n">{kr0(-r.centralen)}</td><td className="n">{r.brutto == null ? <span className="muted">ingen lön</span> : kr0(-r.brutto)}</td><td className="n">{r.ag == null ? '' : kr0(-r.ag)}</td><td className="n strong">{r.res == null ? '' : kr0(r.res)}</td></tr>)}</tbody>
      </table></div>
    </>
  );
}
function exportXlsx(k: Kassa) {
  if (!k.R) return;
  const sheets = [
    { name: 'Lön', rows: [['Förarnr', 'Förare', 'Timmar', 'Inkört exkl moms', 'Bruttolön', 'Skatt', 'Kontant', 'Att utbetala', 'Arbetsgivaravgift'], ...k.LS.map(({ r, L }: any) => [r.id, k.namnFor(r.id), +r.tim.toFixed(2), r.exkl, L.brutto, L.skatt, r.kontant || 0, L.netto, L.ag.belopp])] },
    { name: 'Körpass', rows: [['Start', 'Slut', 'Förare', 'Bil', 'Timmar', 'Kontant', 'Kredit'], ...k.shifts.map((s: any) => [s.start, s.slut, s.forare, s.regnr, +s.tim.toFixed(2), s.kont, s.kred])] },
    { name: 'Bro och Sturup', rows: [['Tid', 'Reg nr', 'Passage', 'Förare', 'Koppling', 'Kostnad'], ...k.R.bro.map((p: any) => [p.ts, p.reg, p.desc, p.forare || '', p.metod, p.kost])] }
  ];
  download(`Akarkassan_${k.period}.xlsx`, writeXlsx(sheets));
}
function Bokforing({ k }: { k: Kassa }) {
  const lk = k.month.lonekorning;
  return (
    <div className="ba-grid ba-grid--2">
      <Card title="Underlag till bokföringen">
        <p className="small muted" style={{ marginTop: 0 }}>Lönelista, körpass och passager för {manad(k.period)} i Excel. Lönekörningen {lk ? `godkändes ${lk.datum}` : 'är inte godkänd än'}.</p>
        <Button icon="download" disabled={!k.R} onClick={() => exportXlsx(k)}>Excel för {manad(k.period)}</Button>
      </Card>
      <Card title="Bank">
        <p className="small muted" style={{ marginTop: 0 }}>Kontoutdraget stäms av mot löneutbetalningarna. Utbetalning {k.utbDatum}{lk ? `, ${krs(Object.values(lk.rader).reduce((x: number, r: any) => x + r.netto, 0))} totalt` : ''}.</p>
      </Card>
    </div>
  );
}
function Inst({ k }: { k: Kassa }) {
  const save = useSave(k);
  const [c, setC] = useState<any>({ ...k.cfg });
  const [bolag, setBolag] = useState<any>({ orgnr: '', adress: '', postadress: '', firmatecknare: '', ...(k.settings.bolag || {}) });
  const fields: [string, string][] = [['procent', 'Procentlön (%)'], ['semester', 'Semesterersättning (%)'], ['utbetDag', 'Utbetalningsdag'], ['broAndel', 'Avdrag bro och Sturup (%)'], ['broPris', 'Bropris per passage (kr)'], ['cphPris', 'CPH per hämtning (kr)'], ['redovForarandel', 'Förarens andel i kassaredovisningen (%)'], ['broMarginalMin', 'Marginal före och efter pass (min)'], ['dagStart', 'Dagpass börjar (timme)'], ['dagSlut', 'Kvällspass börjar (timme)']];
  return (
    <div className="ba-grid ba-grid--2">
      <Card title="Lön och avdrag" actions={<Button variant="dark" size="sm" onClick={() => save('settings', { ...k.settings, cfg: Object.fromEntries(Object.entries(c).filter(([key, v]) => (k.E.DEF as any)[key] !== v)) }, 'Inställningarna är sparade.')}>Spara</Button>}>
        <div className="ba-grid ba-grid--2">{fields.map(([key, l]) => <TextField key={key} label={l} mono value={c[key]} onChange={e => setC({ ...c, [key]: e.target.value === '' ? '' : +e.target.value.replace(',', '.') })} />)}</div>
        <div className="ba-stack" style={{ marginTop: 12 }}>
          <Checkbox label="Sturup dras från lönen" checked={!!c.inklSturup} onChange={e => setC({ ...c, inklSturup: e.target.checked })} />
          <Checkbox label="CPH dras från lönen" checked={!!c.inklPickup} onChange={e => setC({ ...c, inklPickup: e.target.checked })} />
          <Checkbox label="Bomkörning ingår inte i underlaget" checked={!!c.bomBortLon} onChange={e => setC({ ...c, bomBortLon: e.target.checked })} />
        </div>
        <p className="small muted">Arbetsgivaravgiften räknas efter ålder med satser från konfigurationen ({pct(k.cfg.agAvgift, 2)} som standard). Satserna har giltighetsdatum och uppdateras årligen.</p>
      </Card>
      <Card title="Bolaget" actions={<Button variant="dark" size="sm" onClick={() => save('settings', { ...k.settings, bolag }, 'Sparat.')}>Spara</Button>}>
        <div className="ba-stack">
          <TextField label="Organisationsnummer" mono value={bolag.orgnr} onChange={e => setBolag({ ...bolag, orgnr: e.target.value })} />
          <TextField label="Adress" value={bolag.adress} onChange={e => setBolag({ ...bolag, adress: e.target.value })} />
          <TextField label="Postnummer och ort" value={bolag.postadress} onChange={e => setBolag({ ...bolag, postadress: e.target.value })} />
          <TextField label="Firmatecknare" value={bolag.firmatecknare} onChange={e => setBolag({ ...bolag, firmatecknare: e.target.value })} hint="Föreslås när arbetsgivaren signerar avtal" />
        </div>
      </Card>
    </div>
  );
}
export { TP, avDatum };
export const avText2 = (namn: string | undefined, id: string) => /^Förare\s+\S{1,3}$/.test(namn || '') ? String(namn).replace(/^Förare\s+/, '') : initialer(namn || id);

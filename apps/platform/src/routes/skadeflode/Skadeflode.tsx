// Skadeflöde (sidan 47). Ärenden, nytt ärende från kundens mejl, inkorg från skadereglerare och kalkylkontroll.
// AI skriver utkast via servern. Utan AI visas ett utkast att fylla i. Inget skickas automatiskt.
import { useMemo, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Banner, Button, Card, EmptyState, Icon, Input, Kpi, Modal, Pill, Textarea, useToast } from '@bolagsappar/ui';
import { STATUS, STATUS_ORDNING, LIMIT, dagarI, sen, setStatus, kontroll, kontrollText, promptKontroll, promptSvar, svarMall, promptTillagg, tillaggMall, promptIntag, intagUtanAI, nyttArende, normReg } from '@bolagsappar/core/skadeflode';
import { kr0 } from '@bolagsappar/core/format';
import { useAccount } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useDoc, useDocs } from '../../lib/q';
import { usePage, useWelcome } from '../../shell/Help';
import { Loading } from '../../shell/Shell';

const M = 'skadeflode';
const TABS = [['arenden', 'Ärenden'], ['nytt', 'Nytt ärende'], ['inkorg', 'Skadereglerare'], ['kontroll', 'Kalkylkontroll']] as const;
const today = () => new Date().toISOString().slice(0, 10);
const plate = (r: string) => { const s = normReg(r); return s.length === 6 ? s.slice(0, 3) + ' ' + s.slice(3) : s; };
const kr = (n: number) => kr0(n) + ' kr';
const TONE: Record<string, any> = { intag: 'draft', kalkyl: 'info', vantar: 'warn', tillagg: 'warn', produktion: 'info', faktura: 'bad', klar: 'ok' };

function useSf() {
  const a = useAccount();
  const ar = useDocs<any>(a.tenant.id, M, 'arenden');
  const ml = useDocs<any>(a.tenant.id, M, 'mejl');
  const inst = useDoc<any>(a.tenant.id, M, 'installningar');
  const arenden = useMemo(() => (ar.data || []).map(d => d.data).sort((x: any, y: any) => String(y.id).localeCompare(String(x.id), 'sv', { numeric: true })), [ar.data]);
  const mejl = useMemo(() => (ml.data || []).map(d => d.data).sort((x: any, y: any) => String(y.datum).localeCompare(String(x.datum))), [ml.data]);
  const I = { foretag: inst.data?.foretag || a.tenant.name, signatur: inst.data?.signatur || a.tenant.name, epost: inst.data?.epost || '' };
  return { arenden, mejl, I, loading: ar.isLoading || ml.isLoading || inst.isLoading };
}

function useSave() {
  const a = useAccount(); const b = useBackend(); const qc = useQueryClient(); const toast = useToast();
  return async (x: any, msg?: string) => {
    try { await b.setDoc(a.tenant.id, M, 'arenden/' + x.id, x); qc.invalidateQueries({ queryKey: ['documents', a.tenant.id, M] }); if (msg) toast(msg); }
    catch (e: any) { toast(e.code === 'not_granted' ? 'Du har inte behörighet att ändra ärenden.' : e.message, { tone: 'bad' }); }
  };
}

/** Kör AI på servern. Utan AI (lokalt eller ej påslaget) används utkastet utan AI. */
function useAi() {
  const a = useAccount(); const b = useBackend();
  return async (task: string, prompt: string, fallback: string): Promise<{ text: string; ai: boolean; note?: string }> => {
    try { const r = await b.ai(a.tenant.id, task, prompt); return { text: r.text, ai: true }; }
    catch (e: any) {
      const note = e.code === 'rate_limited' ? 'För många förfrågningar just nu. Visar ett utkast utan AI.' : e.code === 'ai_off' ? 'AI är inte påslaget här. Visar ett utkast att granska och fylla i.' : 'AI svarade inte. Visar ett utkast utan AI.';
      return { text: fallback, ai: false, note };
    }
  };
}

export function Skadeflode() {
  const a = useAccount(); const { tab = 'arenden' } = useParams({ strict: false }) as { tab?: string };
  const variant = a.tenant.type === 'direct' ? 'direct' : 'sub';
  const S = useSf();
  useWelcome('skadeflode', variant);
  usePage({ crumbs: ['Skadeflöde', TABS.find(x => x[0] === tab)?.[1] || ''], module: 'skadeflode', variant, view: tab }, [tab]);
  if (S.loading) return <Loading />;
  const head: Record<string, string[]> = {
    arenden: ['Försäkringsärenden', 'Alla skadeärenden från intag till avstämd faktura.'],
    nytt: ['Nytt ärende', 'Klistra in kundens mejl eller skadeanmälan. Ärendekortet fylls i och du granskar innan det sparas.'],
    inkorg: ['Skadereglerare', 'Mejl från försäkringsbolagen kopplas till rätt ärende. Svarsutkast skrivs åt dig, du granskar och skickar.'],
    kontroll: ['Kalkylkontroll', 'Godkänd kalkyl jämförs rad för rad mot arbetsordern innan fakturan går till försäkringsbolaget.']
  };
  return (
    <>
      <div className="pf-head"><div className="ba-grow"><h1 className="pf-h1">{head[tab]?.[0]}</h1><p className="pf-lead">{head[tab]?.[1]}</p></div>
        {tab !== 'nytt' && <Link className="ba-btn ba-btn--primary" to="/$tenant/skadeflode/$tab" params={{ tenant: a.tenant.slug, tab: 'nytt' }}><Icon name="plus" size={16} />Nytt ärende</Link>}</div>
      <nav className="ba-tabs" role="tablist" style={{ marginBottom: 18 }}>{TABS.map(([k, l]) => <Link key={k} to="/$tenant/skadeflode/$tab" params={{ tenant: a.tenant.slug, tab: k }} aria-current={tab === k ? 'page' : undefined}>{l}{k === 'inkorg' && S.mejl.filter((m: any) => !m.besvarad).length ? ` (${S.mejl.filter((m: any) => !m.besvarad).length})` : ''}</Link>)}</nav>
      {tab === 'arenden' && <Arenden S={S} />}
      {tab === 'nytt' && <Nytt S={S} />}
      {tab === 'inkorg' && <Inkorg S={S} />}
      {tab === 'kontroll' && <Kontroll S={S} />}
    </>
  );
}

function Arenden({ S }: { S: any }) {
  const [filter, setFilter] = useState('alla');
  const [open, setOpen] = useState<string | null>(null);
  const t = today();
  const L = S.arenden.filter((x: any) => filter === 'alla' || x.status === filter);
  const oppna = S.arenden.filter((x: any) => x.status !== 'klar');
  const vant = S.arenden.filter((x: any) => x.status === 'vantar' || x.status === 'tillagg');
  const ejDeb = S.arenden.filter((x: any) => x.status === 'faktura').reduce((s: number, x: any) => s + kontroll(x.kalkylrader).ejDebiterat, 0);
  const sena = S.arenden.filter((x: any) => sen(x, t));
  return (
    <>
      <div className="ba-grid ba-grid--4" style={{ marginBottom: 16 }}>
        <Kpi label="Öppna ärenden" value={oppna.length} />
        <Kpi label="Väntar på försäkringsbolag" value={vant.length} sub={`${vant.filter((x: any) => dagarI(x, t) > 2).length} över 2 dagar`} subTone="warn" />
        <Kpi label="Ligger för länge" value={sena.length} sub="över gränsen för statusen" subTone={sena.length ? 'warn' : undefined} />
        <Kpi label="Godkänt men ej debiterat" value={kr(ejDeb)} sub="i ärenden att fakturera" subTone={ejDeb ? 'warn' : undefined} />
      </div>
      <div className="pf-filters" style={{ marginTop: 0 }} role="group" aria-label="Filtrera på status">
        {[['alla', 'Alla'], ['vantar', 'Väntar'], ['tillagg', 'Tillägg'], ['faktura', 'Att fakturera'], ['intag', 'Intag']].map(([k, l]) => <button key={k} className="ba-chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      {!S.arenden.length ? <EmptyState icon="shield" title="Inga ärenden ännu" action={<Link className="ba-btn ba-btn--primary" to="/$tenant/skadeflode/$tab" params={{ tenant: useAccount().tenant.slug, tab: 'nytt' }}>Skapa första ärendet</Link>}>Klistra in kundens skadeanmälan så fylls ärendekortet i.</EmptyState>
        : !L.length ? <EmptyState icon="check" title="Inga ärenden i den här statusen" /> : (
          <div className="ba-table-wrap"><table className="ba-table">
            <thead><tr><th>Ärende</th><th>Reg nr</th><th>Bil och skada</th><th>Försäkringsbolag</th><th>Status</th><th className="n">Kalkyl</th><th className="n">Dagar</th></tr></thead>
            <tbody>{L.map((x: any) => { const d = dagarI(x, t); return (
              <tr key={x.id} className="click" tabIndex={0} onClick={() => setOpen(x.id)} onKeyDown={e => { if (e.key === 'Enter') setOpen(x.id); }}>
                <td className="num b">{x.id}</td><td className="num">{plate(x.reg)}</td>
                <td><div>{x.bil}</div><div className="small muted">{x.typ}</div></td><td>{x.bolag}</td>
                <td><Pill tone={TONE[x.status]}>{STATUS[x.status as keyof typeof STATUS]}</Pill></td>
                <td className="n">{x.kalkyl ? kr0(x.kalkyl) : <span className="muted">ej klar</span>}</td>
                <td className="n">{sen(x, t) ? <Pill tone="bad" dot={false}>{d} d</Pill> : d + ' d'}</td>
              </tr>); })}</tbody>
          </table></div>)}
      {open && <ArendeModal S={S} id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function ArendeModal({ S, id, onClose }: { S: any; id: string; onClose: () => void }) {
  const x = S.arenden.find((y: any) => y.id === id); const save = useSave(); const ai = useAi(); const toast = useToast();
  const [fynd, setFynd] = useState(''); const [ut, setUt] = useState<{ text: string; note?: string } | null>(null); const [busy, setBusy] = useState(false);
  if (!x) return null;
  const t = today(); const i = STATUS_ORDNING.indexOf(x.status); const next = STATUS_ORDNING[i + 1];
  const skriv = async () => { if (!fynd.trim()) { toast('Beskriv först vad teknikern hittade.', { tone: 'bad' }); return; } setBusy(true); setUt(await ai('tillagg', promptTillagg(x, fynd, S.I.foretag, S.I.signatur), tillaggMall(x, fynd.trim(), S.I.signatur))); setBusy(false); };
  return (
    <Modal open wide onClose={onClose} labelledBy="sf-h" title={<span id="sf-h"><span className="num">{plate(x.reg)}</span> · {x.bil}</span>} footer={<>
      <Button onClick={onClose}>Stäng</Button>
      {next && <Button variant="primary" onClick={() => save(setStatus(x, next, t), `Status: ${STATUS[next as keyof typeof STATUS]}.`)}>Flytta till {STATUS[next as keyof typeof STATUS]}</Button>}
    </>}>
      <div className="pf-two">
        <div>
          <dl className="pf-kv">
            <div><dt>Ärendenr</dt><dd>{x.id}</dd></div><div><dt>Kund</dt><dd style={{ fontFamily: 'var(--font)' }}>{x.kund}</dd></div>
            <div><dt>Försäkringsbolag</dt><dd style={{ fontFamily: 'var(--font)' }}>{x.bolag}</dd></div><div><dt>Skadenummer</dt><dd>{x.skadenr}</dd></div>
            <div><dt>Skadereglerare</dt><dd style={{ fontFamily: 'var(--font)' }}>{x.reglerare || 'Ej tilldelad'}</dd></div>
            <div><dt>Kalkyl</dt><dd>{x.kalkyl ? kr(x.kalkyl) : 'ej klar'}</dd></div><div><dt>Självrisk (faktureras kunden)</dt><dd>{kr(x.sjalvrisk)}</dd></div>
            <div><dt>Status</dt><dd><Pill tone={TONE[x.status]}>{STATUS[x.status as keyof typeof STATUS]}</Pill> <span className="small muted">i {dagarI(x, t)} d{LIMIT[x.status as keyof typeof LIMIT] !== undefined ? `, gräns ${LIMIT[x.status as keyof typeof LIMIT]} d` : ''}</span></dd></div>
          </dl>
          <h3 className="pf-h3" style={{ marginTop: 16 }}>Händelser</h3>
          <ol className="pf-list-plain small" style={{ display: 'grid', gap: 6 }}>{(x.logg || []).map((l: any, j: number) => <li key={j}><span className="num muted">{l.d}</span> {l.t}</li>)}</ol>
        </div>
        <div className="ba-stack">
          <h3 className="pf-h3" style={{ margin: 0 }}>Tilläggsbegäran till skadereglerare</h3>
          <label className="ba-field"><span className="ba-label">Vad hittade teknikern?</span><Textarea rows={4} value={fynd} onChange={e => setFynd(e.target.value)} placeholder="Beskriv dold skada, delar och uppskattad tid" /></label>
          <div className="ba-row"><Button icon="sparkles" onClick={skriv} disabled={busy}>{busy ? 'Skriver...' : `Skriv mejl till ${String(x.reglerare || 'skaderegleraren').split(' ')[0]}`}</Button>{ut && <Button variant="link" onClick={() => { navigator.clipboard?.writeText(ut.text); toast('Kopierat.'); }}>Kopiera</Button>}</div>
          {ut?.note && <Banner tone="info">{ut.note}</Banner>}
          <pre className="pf-draft" aria-live="polite">{ut ? ut.text : 'Utkastet visas här. Inget skickas automatiskt.'}</pre>
          {ut && x.status !== 'tillagg' && <Button size="sm" onClick={() => save(setStatus(x, 'tillagg', t, 'Tillägg begärt, väntar svar'), 'Ärendet väntar på svar om tillägget.')}>Markera tillägg begärt</Button>}
        </div>
      </div>
    </Modal>
  );
}

function Nytt({ S }: { S: any }) {
  const a = useAccount(); const b = useBackend(); const save = useSave(); const toast = useToast();
  const [text, setText] = useState(''); const [bilder, setBilder] = useState<File[]>([]);
  const [k, setK] = useState<any>(null); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const las = async () => {
    if (!text.trim()) { toast('Klistra in kundens mejl först.', { tone: 'bad' }); return; }
    setBusy(true); setNote('');
    try { const r = await b.ai(a.tenant.id, 'intag', promptIntag(S.I.foretag, text)); setK(JSON.parse(String(r.text).replace(/^[^{]*/, '').replace(/[^}]*$/, ''))); }
    catch (e: any) { setK(intagUtanAI(text)); setNote(e.code === 'ai_off' ? 'AI är inte påslaget här. Det som gick att läsa ut ur texten är ifyllt, fyll i resten.' : 'AI kunde inte läsa anmälan. Det som gick att läsa ut är ifyllt, fyll i resten.'); }
    setBusy(false);
  };
  const skapa = async () => {
    if (!normReg(k.regnr)) { toast('Fyll i registreringsnumret.', { tone: 'bad' }); return; }
    const x = nyttArende(k, S.arenden.map((y: any) => y.id), today()); x.bilder = bilder.length;
    await save(x, `Ärende ${x.id} är skapat.`); setK(null); setText(''); setBilder([]);
  };
  const F = (key: string, label: string, mono = false) => <label className="ba-field"><span className="ba-label">{label}</span><Input mono={mono} value={k[key] ?? ''} onChange={e => setK({ ...k, [key]: e.target.value })} /></label>;
  return (
    <div className="pf-two">
      <Card title="Kundens meddelande">
        <Textarea rows={12} value={text} onChange={e => setText(e.target.value)} placeholder="Klistra in mejlet eller skadeanmälan här" aria-label="Kundens meddelande" />
        <div className="ba-row" style={{ marginTop: 10 }}>
          <label className="ba-btn"><Icon name="upload" size={16} />Skadebilder<input type="file" accept="image/*" multiple hidden onChange={e => setBilder([...(e.target.files || [])].slice(0, 4))} /></label>
          {bilder.length > 0 && <span className="small muted">{bilder.length} bilder valda (stannar på datorn i förhandsvisningen)</span>}
          <span className="ba-grow" />
          {!text && <Button variant="link" onClick={() => import('@bolagsappar/core/testdata').then(m => setText(m.skadeflodeDemo().exempelAnmalan))}>Prova med exempel</Button>}
          <Button variant="primary" icon="sparkles" onClick={las} disabled={busy}>{busy ? 'Läser...' : 'Fyll i ärendekortet'}</Button>
        </div>
      </Card>
      <Card title="Ärendekort">
        {!k ? <EmptyState icon="file" title="Ärendekortet visas här">Uppgifterna fylls i från meddelandet. Du granskar innan ärendet sparas.</EmptyState> : (
          <div className="ba-stack">
            {note && <Banner tone="info">{note}</Banner>}
            <div className="ba-grid ba-grid--2">{F('kund', 'Kund')}{F('telefon', 'Telefon', true)}{F('regnr', 'Reg nr', true)}{F('bil', 'Bil')}{F('bolag', 'Försäkringsbolag')}{F('skadenr', 'Skadenummer', true)}{F('sjalvrisk', 'Självrisk (kr)', true)}{F('skadetyp', 'Skadetyp')}</div>
            {k.moment?.length > 0 && <div><div className="ba-label">Förslag på moment till kalkylen</div><ul className="small">{k.moment.map((m: any, j: number) => <li key={j}>{m.moment} <span className="muted">({m.typ})</span></li>)}</ul></div>}
            {k.saknas?.length > 0 && <Banner>Saknas innan kalkyl: {k.saknas.join(', ')}.</Banner>}
            <p className="small muted" style={{ margin: 0 }}>Förslaget är ett stöd. Kalkylen görs och skickas alltid av verkstaden.</p>
            <div><Button variant="dark" onClick={skapa}>Lägg till i ärendelistan</Button></div>
          </div>)}
      </Card>
    </div>
  );
}

function Inkorg({ S }: { S: any }) {
  const a = useAccount(); const b = useBackend(); const qc = useQueryClient(); const ai = useAi(); const toast = useToast();
  const [sel, setSel] = useState<string | null>(S.mejl[0]?.id || null);
  const [hint, setHint] = useState(''); const [ut, setUt] = useState<{ text: string; note?: string } | null>(null); const [busy, setBusy] = useState(false);
  if (!S.mejl.length) return <EmptyState icon="inbox" title="Inga mejl från skadereglerare">Vidarebefordra mejl från försäkringsbolagen till {S.I.epost || 'verkstadens skadeadress'} så hamnar de här, kopplade till rätt ärende.</EmptyState>;
  const m = S.mejl.find((x: any) => x.id === sel); const x = m && S.arenden.find((y: any) => y.id === m.arende);
  const foresla = async () => { setBusy(true); setUt(await ai('svar', promptSvar(x || {}, m, S.I.foretag, hint), m.svar || svarMall(x || { reg: '', skadenr: '' }, m, S.I.signatur))); setBusy(false); };
  const besvarad = async () => { await b.setDoc(a.tenant.id, M, 'mejl/' + m.id, { ...m, besvarad: today() }); qc.invalidateQueries({ queryKey: ['documents', a.tenant.id, M] }); toast('Markerat som besvarat.'); };
  return (
    <div className="pf-sidebar-layout" style={{ gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)' }}>
      <div role="listbox" aria-label="Mejl" className="ba-stack" style={{ gap: 8 }}>{S.mejl.map((y: any) => (
        <button key={y.id} role="option" aria-selected={sel === y.id} className={'pf-mail' + (sel === y.id ? ' is-sel' : '')} onClick={() => { setSel(y.id); setUt(null); setHint(''); }}>
          <span className="ba-row small" style={{ justifyContent: 'space-between' }}><span>{y.fran}</span><span className="num muted">{y.datum}</span></span>
          <b>{y.amne}</b><span className="small muted">Kopplat till {y.arende}{y.besvarad ? ' · besvarat' : ''}</span>
        </button>))}</div>
      {m && <Card title={m.amne} headExtra={<span className="small muted">{m.fran} · {m.datum}{x ? ` · ${plate(x.reg)} ${x.id}` : ''}</span>}>
        <pre className="pf-draft" style={{ background: 'transparent', border: 0, padding: 0 }}>{m.text}</pre>
        <div className="ba-stack" style={{ marginTop: 14 }}>
          <label className="ba-field"><span className="ba-label">Instruktion (valfritt)</span><Input value={hint} onChange={e => setHint(e.target.value)} placeholder="T.ex. stå fast vid byte av motorhuv, var vänlig men bestämd" /></label>
          <div className="ba-row"><Button variant="primary" icon="sparkles" onClick={foresla} disabled={busy}>{busy ? 'Skriver...' : 'Föreslå svar'}</Button>{ut && <><Button onClick={() => { navigator.clipboard?.writeText(ut.text); toast('Kopierat. Klistra in i din e-post.'); }}>Kopiera</Button>{!m.besvarad && <Button variant="link" onClick={besvarad}>Markera besvarat</Button>}</>}</div>
          {ut?.note && <Banner tone="info">{ut.note}</Banner>}
          <pre className="pf-draft" aria-live="polite">{ut ? ut.text : 'Svarsutkastet visas här. Granska innan du skickar.'}</pre>
        </div>
      </Card>}
    </div>
  );
}

function Kontroll({ S }: { S: any }) {
  const ai = useAi();
  const kand = S.arenden.filter((x: any) => x.kalkylrader?.length);
  const [id, setId] = useState(kand.find((x: any) => x.status === 'faktura')?.id || kand[0]?.id);
  const [ut, setUt] = useState<{ text: string; note?: string } | null>(null); const [busy, setBusy] = useState(false);
  if (!kand.length) return <EmptyState icon="check" title="Ingen kalkyl att kontrollera">När ett ärende har en godkänd kalkyl och en arbetsorder jämförs de här rad för rad.</EmptyState>;
  const x = kand.find((y: any) => y.id === id) || kand[0]; const K = kontroll(x.kalkylrader);
  return (
    <div className="ba-stack">
      <div className="ba-row">{kand.map((y: any) => <button key={y.id} className="ba-chip" aria-pressed={y.id === x.id} onClick={() => { setId(y.id); setUt(null); }}>{y.id} · {plate(y.reg)}</button>)}</div>
      <div className="pf-sidebar-layout pf-sidebar-layout--right">
        <Card title={`${x.id} · ${plate(x.reg)}`} headExtra={<span className="small muted">{x.bolag}, {x.skadenr}</span>}>
          <div className="ba-table-wrap"><table className="ba-table">
            <thead><tr><th>Moment</th><th>Typ</th><th className="n">Kalkyl</th><th className="n">Arbetsorder</th><th className="n">Skillnad</th></tr></thead>
            <tbody>{K.rader.map((r: any, j: number) => <tr key={j} className={r.flagga ? 'is-dev' : ''}><td>{r.moment}</td><td className="muted">{r.typ}</td><td className="n">{kr0(r.kalkyl)}</td><td className="n">{r.arbetsorder ? kr0(r.arbetsorder) : <Pill tone="bad" dot={false}>saknas</Pill>}</td><td className="n">{r.diff ? <span className={r.diff < 0 ? 'bad' : ''}>{kr0(r.diff)}</span> : <span className="muted">0</span>}</td></tr>)}</tbody>
          </table></div>
        </Card>
        <div className="ba-stack">
          <Card><dl className="pf-kv"><div><dt>Godkänd kalkyl (exkl. moms)</dt><dd>{kr(K.kalkyl)}</dd></div><div><dt>På arbetsorder</dt><dd>{kr(K.arbetsorder)}</dd></div><div className="tot"><dt>Godkänt men ej debiterat</dt><dd className={K.ejDebiterat ? 'bad' : ''}>{kr(K.ejDebiterat)}</dd></div><div><dt>Självrisk att fakturera kund</dt><dd>{kr(x.sjalvrisk)}</dd></div></dl></Card>
          <Button icon="sparkles" disabled={busy} onClick={async () => { setBusy(true); setUt(await ai('kontroll', promptKontroll(x, S.I.foretag), kontrollText(x))); setBusy(false); }}>{busy ? 'Går igenom...' : 'Gå igenom avvikelserna'}</Button>
          {ut?.note && <Banner tone="info">{ut.note}</Banner>}
          {ut && <pre className="pf-draft" aria-live="polite">{ut.text}</pre>}
        </div>
      </div>
    </div>
  );
}

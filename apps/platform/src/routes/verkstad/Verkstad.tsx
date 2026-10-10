// Verkstad för direktkund (sidan 42). Samma skal och komponenter. Flikarna och momsflödet kommer från foliering.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Banner, Button, Card, DropZone, EmptyState, Icon, Input, Kpi, Modal, Pill, Select, TextField, useToast } from '@bolagsappar/ui';
import { createVerkstad, verkstadActions } from '@bolagsappar/core/verkstad';
import { parseBankRows } from '@bolagsappar/core/avrakning';
import { rawLinesTol } from '@bolagsappar/core/filetypes';
import { kr0, kr2, krs, manad, Manad } from '@bolagsappar/core/format';
import { useAccount } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useDocs } from '../../lib/q';
import { readLocal, download } from '../../lib/files';
import { usePage, useWelcome } from '../../shell/Help';
import { Loading } from '../../shell/Shell';

const VM = 'verkstad';
const TABS = [['oversikt', 'Översikt'], ['arenden', 'Ärenden'], ['jobb', 'Jobb'], ['fakturor', 'Fakturor'], ['betalningar', 'Betalningar'], ['ekonomi', 'Ekonomi'], ['bokforing', 'Bokföring'], ['register', 'Register'], ['installningar', 'Inställningar']] as const;
const plate = (r: string) => { const s = String(r || '').toUpperCase().replace(/\s/g, ''); return /^[A-Z]{3}\d{2}[A-Z0-9]$/.test(s) ? s.slice(0, 3) + ' ' + s.slice(3) : s; };
const normReg = (r: string) => String(r || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function useVerkstad() {
  const a = useAccount(); const t = a.tenant.id;
  const q = { arenden: useDocs<any>(t, VM, 'arenden'), fordon: useDocs<any>(t, VM, 'fordon'), forsakring: useDocs<any>(t, VM, 'forsakring'), kostnader: useDocs<any>(t, VM, 'kostnader'), bokforing: useDocs<any>(t, VM, 'bokforing'), lonespec: useDocs<any>(t, VM, 'lonespec'), inst: useDocs<any>(t, VM, 'installningar') };
  const loading = Object.values(q).some(x => x.isLoading);
  const V = useMemo(() => {
    if (loading) return null;
    const map = (L: any[] | undefined, key = (d: any) => d.id) => new Map((L || []).map(d => [key(d), structuredClone(d.data)]));
    const S = { arenden: map(q.arenden.data), fordon: map(q.fordon.data, d => normReg(d.data.reg || d.id)), forsakring: map(q.forsakring.data), kostnader: map(q.kostnader.data), bokforing: map(q.bokforing.data), lonespec: map(q.lonespec.data), inst: Object.fromEntries((q.inst.data || []).map(d => [d.id, d.data])) };
    return createVerkstad({ S });
  }, [loading, q.arenden.data, q.fordon.data, q.forsakring.data, q.kostnader.data, q.bokforing.data, q.lonespec.data, q.inst.data]);
  return { V, X: V ? verkstadActions(V) : null, loading, t };
}

function useSaveA() {
  const a = useAccount(); const b = useBackend(); const qc = useQueryClient(); const toast = useToast();
  return async (x: any, msg?: string, serie?: any) => {
    try {
      await b.setDoc(a.tenant.id, VM, 'arenden/' + x.id, { ...x, andrad: new Date().toISOString() });
      if (serie) await b.setDoc(a.tenant.id, VM, 'installningar/serie', serie);
      qc.invalidateQueries({ queryKey: ['documents', a.tenant.id, VM] }); if (msg) toast(msg);
    } catch (e: any) { toast(e.message, { tone: 'bad' }); }
  };
}

const ST: Record<string, [string, any]> = { utkast: ['Utkast', 'draft'], skickad: ['Offert skickad', 'warn'], godkand: ['Godkänd', 'info'], fakturerad: ['Fakturerad', 'info'], betald: ['Betald', 'ok'], avslag: ['Avslag', 'bad'] };
function statusPill(V: any, a: any) {
  if (a.faktura && !a.faktura.betald && V.fakStatus(a.faktura) === 'forfallen') return <Pill tone="bad">Förfallen {V.daysBetween(a.faktura.forfall, V.today())} dagar</Pill>;
  if (a.status === 'betald' && a.moms) return <Pill tone="ok">Betald, momsfaktura {a.moms.betald ? 'betald' : a.moms.skickad ? 'skickad' : 'klar'}</Pill>;
  const s = ST[a.status] || [a.status, 'draft']; return <Pill tone={s[1]}>{s[0]}</Pill>;
}

export function Verkstad() {
  const a = useAccount(); const { tab = 'arenden' } = useParams({ strict: false }) as { tab?: string };
  const { V, loading } = useVerkstad();
  const [nytt, setNytt] = useState(false);
  useWelcome('verkstad', 'direct');
  usePage({ crumbs: ['Verkstad', TABS.find(x => x[0] === tab)?.[1] || ''], module: 'verkstad', variant: 'direct', view: tab }, [tab]);
  if (loading || !V) return <Loading />;
  const head = { oversikt: ['Översikt', 'Det viktigaste just nu.'], arenden: ['Ärenden', 'Offert, faktura och momsfaktura mot försäkringsbolagen.'], jobb: ['Jobb', 'Utförda jobb och lön per montör.'], fakturor: ['Fakturor', 'Fakturor till försäkringsbolag och momsfakturor till fordonsägare.'], betalningar: ['Betalningar', 'Läs in bankfilen så matchas betalningarna. Du bekräftar.'], ekonomi: ['Ekonomi', 'Intäkter, kostnader och resultat per månad.'], bokforing: ['Bokföring', 'Verifikationer per månad och SIE till bokföringen.'], register: ['Register', 'Försäkringsbolag och fordonsägare.'], installningar: ['Inställningar', 'Företagsuppgifter och prislista.'] } as Record<string, string[]>;
  return (
    <>
      <div className="pf-head"><div className="ba-grow"><h1 className="pf-h1">{head[tab]?.[0]}</h1><p className="pf-lead">{head[tab]?.[1]}</p></div><Button variant="primary" icon="plus" onClick={() => setNytt(true)}>Nytt ärende</Button></div>
      <nav className="ba-tabs" role="tablist" style={{ marginBottom: 18 }}>{TABS.map(([k, l]) => <Link key={k} to="/$tenant/verkstad/$tab" params={{ tenant: a.tenant.slug, tab: k }} aria-current={tab === k ? 'page' : undefined}>{l}</Link>)}</nav>
      {(tab === 'arenden' || tab === 'oversikt') && <Kpis V={V} />}
      {tab === 'oversikt' && <Oversikt V={V} />}
      {tab === 'arenden' && <Arenden V={V} />}
      {tab === 'jobb' && <Jobb V={V} />}
      {tab === 'fakturor' && <Fakturor V={V} />}
      {tab === 'betalningar' && <Betalningar />}
      {tab === 'ekonomi' && <Ekonomi V={V} />}
      {tab === 'bokforing' && <Bokforing V={V} />}
      {tab === 'register' && <Register V={V} />}
      {tab === 'installningar' && <Inst V={V} />}
      {nytt && <NyttArende V={V} onClose={() => setNytt(false)} />}
    </>
  );
}

function Kpis({ V }: { V: any }) {
  const L = V.arList(), t = V.today(), s = (x: any[]) => x.reduce((a, b) => a + V.belopp(b), 0);
  const skick = L.filter((a: any) => a.status === 'skickad'), obet = L.filter((a: any) => a.faktura && !a.faktura.betald), moms = V.momsAttSkicka();
  const betM = L.filter((a: any) => a.faktura?.betald && (a.faktura.betaldDatum || '').slice(0, 7) === t.slice(0, 7));
  return (
    <div className="ba-grid ba-grid--4" style={{ marginBottom: 16 }}>
      <Kpi label="Väntande offerter" value={skick.length} sub={krs(s(skick), false)} />
      <Kpi label="Utestående" value={obet.length} sub={krs(s(obet), false)} />
      <Kpi label="Momsfakturor att skicka" value={moms.length} sub="till fordonsägare" subTone="warn" />
      <Kpi label={`Betalt i ${manad(t.slice(0, 7))}`} value={krs(s(betM), false)} sub={`${betM.length} ${betM.length === 1 ? 'ärende' : 'ärenden'}`} />
    </div>
  );
}

function Oversikt({ V }: { V: any }) {
  const a = useAccount(); const todo = V.attGora();
  return (
    <Card title="Att göra" headExtra={<span className="small muted">{todo.length} punkter</span>}>
      {!todo.length ? <EmptyState icon="check" title="Inget att göra just nu" /> : <ul className="pf-list-plain" style={{ display: 'grid', gap: 8 }}>{todo.slice(0, 15).map((x: any) => (
        <li key={x.a.id + x.h} className="ba-row" style={{ flexWrap: 'nowrap' }}><Pill tone={x.sev === 'bad' ? 'bad' : x.sev === 'warn' ? 'warn' : 'info'} dot={false}>{plate(x.a.reg)}</Pill><span className="ba-grow"><b className="small">{x.h}</b><div className="small muted">{x.s}</div></span><Link className="ba-btn ba-btn--sm" to="/$tenant/verkstad/arende/$id" params={{ tenant: a.tenant.slug, id: x.a.id }}>{x.btn}</Link></li>
      ))}</ul>}
    </Card>
  );
}

function Arenden({ V }: { V: any }) {
  const a = useAccount(); const nav = useNavigate();
  const [q, setQ] = useState('');
  const L = V.arList().sort((x: any, y: any) => String(y.id).localeCompare(String(x.id), 'sv', { numeric: true })).filter((x: any) => !q || [x.id, x.reg, x.skadenr, V.fors(x.forsakring).namn].join(' ').toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="pf-filters" style={{ marginTop: 0 }}><label className="pf-searchbox" style={{ marginLeft: 0 }}><Icon name="search" size={14} /><input placeholder="Sök ärende, reg nr eller skadenummer" value={q} onChange={e => setQ(e.target.value)} aria-label="Sök ärende" /></label></div>
      {!L.length ? <EmptyState icon="brush" title="Inga ärenden ännu">Skapa det första ärendet med knappen Nytt ärende. Ett ärende är en skada på ett fordon: offert, faktura och momsfaktura samlas där.</EmptyState> : (
        <div className="ba-table-wrap"><table className="ba-table">
          <thead><tr><th>Ärende</th><th>Reg.nr</th><th>Försäkringsbolag</th><th>Arbete</th><th className="n">Exkl. moms</th><th>Status</th></tr></thead>
          <tbody>{L.map((x: any) => <tr key={x.id} className="click" onClick={() => nav({ to: '/$tenant/verkstad/arende/$id', params: { tenant: a.tenant.slug, id: x.id } })}><td className="num b">{x.id}</td><td className="num">{plate(x.reg)}</td><td>{V.fors(x.forsakring).namn}</td><td className="small">{(x.faktura?.rader || x.offert?.rader || []).map((r: any) => String(r.text).replace(/^Foliering\s+/i, '')).join(', ').slice(0, 60)}</td><td className="n">{kr2(V.belopp(x))}</td><td>{statusPill(V, x)}</td></tr>)}</tbody>
        </table></div>
      )}
    </>
  );
}

function NyttArende({ V, onClose }: { V: any; onClose: () => void }) {
  const a = useAccount(); const nav = useNavigate(); const save = useSaveA();
  const fl = V.forsList();
  const [f, setF] = useState({ reg: '', skadenr: '', forsakring: fl[0]?.id || '', storlek: 'vanlig' });
  const go = async () => { if (!f.reg.trim()) return; const { a: x } = verkstadActions(V).nytt(f); await save(x, `Ärende ${x.id} är skapat.`); onClose(); nav({ to: '/$tenant/verkstad/arende/$id', params: { tenant: a.tenant.slug, id: x.id } }); };
  return (
    <Modal open onClose={onClose} title="Nytt ärende" labelledBy="na-h" footer={<><Button onClick={onClose}>Avbryt</Button><Button variant="primary" onClick={go}>Skapa</Button></>}>
      <div className="ba-stack">
        <TextField label="Reg nr" mono value={f.reg} onChange={e => setF({ ...f, reg: e.target.value })} placeholder="ABC 123" />
        <TextField label="Skadenummer" mono value={f.skadenr} onChange={e => setF({ ...f, skadenr: e.target.value })} />
        <label className="ba-field"><span className="ba-label">Försäkringsbolag</span><Select value={f.forsakring} onChange={e => setF({ ...f, forsakring: e.target.value })}>{fl.map((x: any) => <option key={x.id} value={x.id}>{x.namn}</option>)}</Select></label>
        <label className="ba-field"><span className="ba-label">Storlek</span><Select value={f.storlek} onChange={e => setF({ ...f, storlek: e.target.value })}><option value="vanlig">Vanlig bil</option><option value="storre">Större bil</option></Select></label>
      </div>
    </Modal>
  );
}

export function Arende() {
  const acc = useAccount(); const { id } = useParams({ strict: false }) as { id: string };
  const { V, X, loading } = useVerkstad(); const save = useSaveA(); const toast = useToast();
  const [godkAv, setGodkAv] = useState('');
  const [bet, setBet] = useState(new Date().toISOString().slice(0, 10));
  const [logg, setLogg] = useState('');
  usePage({ crumbs: ['Verkstad', id], module: 'verkstad', variant: 'direct', view: 'arenden' }, [id]);
  if (loading || !V || !X) return <Loading />;
  const a = V.S.arenden.get(id);
  if (!a) return <EmptyState title="Ärendet finns inte" />;
  const f = V.fors(a.forsakring), lock = !!a.faktura, rader = a.offert?.rader || [];
  const P = V.priser();
  const act = (r: any) => save(r.a, r.msg, r.serie);
  const setRad = (i: number, k: string, v: any) => save({ ...a, offert: { ...a.offert, rader: rader.map((r: any, j: number) => j === i ? { ...r, [k]: v } : r) } });
  const addPris = (pid: string) => { const p = P.find((x: any) => x.id === pid); if (!p) return; save({ ...a, offert: { ...a.offert, rader: [...rader, { pid, text: p.text, antal: 1, apris: a.storlek === 'storre' ? +p.storre : +p.vanlig }] } }); };
  const idx = ['utkast', 'skickad', 'godkand', 'fakturerad', 'betald'].indexOf(a.status);
  return (
    <>
      <div className="pf-head">
        <div className="ba-grow"><div className="pf-eyebrow">Ärende {a.id} · {f.namn}{a.skadenr ? ' · skadenr ' + a.skadenr : ''}</div><h1 className="pf-h1 num">{plate(a.reg)}</h1></div>
        {statusPill(V, a)}
      </div>
      <ol className="ba-steps" style={{ marginBottom: 18 }}>{['Utkast', 'Offert skickad', 'Godkänd', 'Fakturerad', 'Betald'].map((s, i) => <li key={s} style={{ display: 'contents' }}>{i > 0 && <span className="ba-step__sep" />}<span className={'ba-step ' + (i < idx ? 'ba-step--done' : i === idx ? 'ba-step--current' : '')}><span className="ba-step__n">{i < idx ? <Icon name="check" size={13} /> : i + 1}</span>{s}</span></li>)}</ol>
      <div className="pf-sidebar-layout pf-sidebar-layout--right">
        <div className="ba-stack">
          <Card title="Offert" headExtra={a.offert?.godkandAv ? <span className="small muted">Godkänd av {a.offert.godkandAv}</span> : undefined}>
            <div className="ba-table-wrap"><table className="ba-table"><thead><tr><th>Beskrivning</th><th className="n">Antal</th><th className="n">À-pris</th><th className="n">Summa</th>{!lock && <th />}</tr></thead>
              <tbody>{rader.map((r: any, i: number) => <tr key={i}>{lock ? <><td>{r.text}</td><td className="n">{r.antal}</td><td className="n">{kr2(r.apris)}</td></> : <><td><Input value={r.text} style={{ height: 34 }} onChange={e => setRad(i, 'text', e.target.value)} aria-label="Beskrivning" /></td><td className="n"><Input mono value={r.antal} style={{ height: 34, width: 70 }} onChange={e => setRad(i, 'antal', +e.target.value || 0)} aria-label="Antal" /></td><td className="n"><Input mono value={r.apris} style={{ height: 34, width: 100 }} onChange={e => setRad(i, 'apris', +e.target.value || 0)} aria-label="À-pris" /></td></>}<td className="n">{kr2(r.antal * r.apris)}</td>{!lock && <td><Button size="sm" variant="link" onClick={() => save({ ...a, offert: { ...a.offert, rader: rader.filter((_: any, j: number) => j !== i) } })}>Ta bort</Button></td>}</tr>)}</tbody>
              <tfoot><tr><td colSpan={3}>Totalt exkl. moms</td><td className="n">{kr2(V.sumRows(rader))}</td>{!lock && <td />}</tr></tfoot></table></div>
            {!lock && <div className="ba-row" style={{ marginTop: 10 }}><Select value="" onChange={e => addPris(e.target.value)} aria-label="Lägg till från prislistan" style={{ maxWidth: 320 }}><option value="">Lägg till från prislistan</option>{P.map((p: any) => <option key={p.id} value={p.id}>{p.text} ({kr0(a.storlek === 'storre' ? p.storre : p.vanlig)} kr)</option>)}</Select><Button size="sm" onClick={() => save({ ...a, offert: { ...a.offert, rader: [...rader, { text: 'Foliering ', antal: 1, apris: 0 }] } })}>Egen rad</Button></div>}
            <div className="ba-row" style={{ marginTop: 14 }}>
              <Button icon="download" disabled={!rader.length} onClick={() => pdfDok(V, a, 'offert')}>Offert (PDF)</Button>
              {a.status === 'utkast' && <Button variant="dark" disabled={!rader.length} onClick={() => act(X.skickad(a))}>Markera som skickad</Button>}
              {a.status === 'skickad' && <Button onClick={() => act(X.offertIgen(a))}>Påminnelse skickad</Button>}
              {['skickad', 'utkast'].includes(a.status) && <><Input placeholder="Godkänd av (handläggare)" value={godkAv} onChange={e => setGodkAv(e.target.value)} style={{ width: 220 }} /><Button variant="dark" onClick={() => act(X.godkand(a, godkAv.trim()))}>Markera godkänd</Button></>}
              {['skickad', 'godkand'].includes(a.status) && <Button variant="link" onClick={() => act(X.avslag(a))}>Avslag</Button>}
              {a.status === 'avslag' && <Button onClick={() => act(X.ateroppna(a))}>Återöppna</Button>}
            </div>
          </Card>
          <Card title={a.faktura ? `Faktura ${a.faktura.nr}` : 'Faktura'} headExtra={a.faktura ? <Pill tone={a.faktura.betald ? 'ok' : V.fakStatus(a.faktura) === 'forfallen' ? 'bad' : 'warn'}>{a.faktura.betald ? 'Betald ' + a.faktura.betaldDatum : V.fakStatus(a.faktura) === 'forfallen' ? 'Förfallen' : 'Ej betald'}</Pill> : <Pill>Ej skapad</Pill>}>
            {!a.faktura ? <>
              <p className="small muted" style={{ marginTop: 0 }}>Fakturan skapas från offertens rader. Nummer {V.nastaFaktura()}, {V.foretag().villkorDagar} dagar netto, till {f.namn}.</p>
              <Button variant="primary" disabled={!rader.length || !['skickad', 'godkand', 'utkast'].includes(a.status)} onClick={() => act(X.skapaFaktura(a))}>Skapa faktura {V.nastaFaktura()}</Button>
            </> : <>
              <dl className="pf-kv"><div><dt>Fakturadatum</dt><dd>{a.faktura.datum}</dd></div><div><dt>Förfaller</dt><dd>{a.faktura.forfall}</dd></div><div><dt>Att betala</dt><dd>{kr2(V.sumRows(a.faktura.rader))} kr</dd></div>{a.faktura.paminnelse && <div><dt>Påminnelse</dt><dd>{a.faktura.paminnelse}</dd></div>}</dl>
              <div className="ba-row" style={{ marginTop: 12 }}>
                <Button icon="download" onClick={() => pdfDok(V, a, 'faktura')}>Faktura (PDF)</Button>
                <Button onClick={() => act(X.fakturaSkickad(a))}>Skickad till {f.namn}</Button>
                {!a.faktura.betald ? <><Button onClick={() => act(X.paminnelseKlar(a))}>Påminnelse skickad</Button><Input type="date" value={bet} onChange={e => setBet(e.target.value)} style={{ width: 160 }} aria-label="Betaldatum" /><Button variant="dark" onClick={() => act(X.betald(a, bet))}>Markera betald</Button><Button variant="link" onClick={() => { if (confirm(`Makulera faktura ${a.faktura.nr}?`)) act(X.makulera(a)); }}>Makulera</Button></>
                  : <Button variant="link" onClick={() => act(X.obetald(a))}>Ångra betald</Button>}
              </div>
            </>}
          </Card>
          {a.faktura && <Card title={a.moms ? `Momsfaktura ${a.moms.nr}` : 'Momsfaktura'} headExtra={a.moms ? <Pill tone={a.moms.betald ? 'ok' : a.moms.skickad ? 'warn' : 'info'}>{a.moms.betald ? 'Betald' : a.moms.skickad ? 'Skickad' : 'Klar att skicka'}</Pill> : <Pill>{a.faktura.betald ? 'Ej skapad' : 'Väntar på försäkringsbolaget'}</Pill>}>
            {!a.moms ? (a.faktura.betald
              ? <><p className="small muted" style={{ marginTop: 0 }}>Momsen, {kr2(V.momsBelopp(a))} kr, faktureras fordonsägaren.</p><Button variant="primary" disabled={!a.agare} onClick={() => act(X.skapaMoms(a))}>Skapa momsfaktura M-{a.faktura.nr}</Button>{!a.agare && <p className="small muted">Lägg in fordonsägaren under Register först.</p>}</>
              : <p className="small muted" style={{ margin: 0 }}>Momsfakturan M-{a.faktura.nr} ({kr2(V.momsBelopp(a))} kr) skapas automatiskt och dateras samma dag som {f.namn} betalar faktura {a.faktura.nr}.</p>)
              : <>
                <dl className="pf-kv"><div><dt>Till</dt><dd style={{ fontFamily: 'var(--font)' }}>{a.moms.till}</dd></div><div><dt>Moms 25 %</dt><dd>{kr2(V.momsBelopp(a))} kr</dd></div><div><dt>Förfaller</dt><dd>{a.moms.forfall}</dd></div></dl>
                <div className="ba-row" style={{ marginTop: 12 }}><Button icon="download" onClick={() => pdfDok(V, a, 'moms')}>Momsfaktura (PDF)</Button>{!a.moms.skickad && <Button variant="dark" onClick={() => act(X.momsSkickad(a))}>Skickad till fordonsägaren</Button>}{a.moms.skickad && !a.moms.betald && <Button variant="dark" onClick={() => act(X.momsBetald(a, bet))}>Markera betald</Button>}{a.moms.betald && <Button variant="link" onClick={() => act(X.momsObetald(a))}>Ångra betald</Button>}</div>
              </>}
          </Card>}
        </div>
        <aside className="ba-stack">
          <Card title="Uppgifter">
            <dl className="pf-kv"><div><dt>Fordonsägare</dt><dd style={{ fontFamily: 'var(--font)' }}>{a.agare || V.agareInfo(a).agare || 'Saknas'}</dd></div><div><dt>Storlek</dt><dd style={{ fontFamily: 'var(--font)' }}>{a.storlek === 'storre' ? 'Större bil' : 'Vanlig bil'}</dd></div><div><dt>Skapad</dt><dd>{a.skapad}</dd></div></dl>
          </Card>
          <Card title="Historik">
            {!(a.logg || []).length && <p className="small muted" style={{ marginTop: 0 }}>Inga händelser än.</p>}
            <ul className="pf-list-plain small" style={{ display: 'grid', gap: 6 }}>{[...(a.logg || [])].reverse().map((l: any, i: number) => <li key={i}><span className="num muted">{l.d}</span> {l.t}</li>)}</ul>
            <div className="ba-row" style={{ marginTop: 10, flexWrap: 'nowrap' }}><Input placeholder="Anteckning" value={logg} onChange={e => setLogg(e.target.value)} /><Button size="sm" onClick={() => { if (logg.trim()) { act(X.addlog(a, logg.trim())); setLogg(''); } }}>Lägg till</Button></div>
          </Card>
        </aside>
      </div>
    </>
  );
}

function pdfDok(V: any, a: any, typ: 'offert' | 'faktura' | 'moms') {
  const F = V.foretag(), f = V.fors(a.forsakring);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const titel = typ === 'offert' ? 'Offert' : typ === 'faktura' ? `Faktura ${a.faktura.nr}` : `Momsfaktura ${a.moms.nr}`;
  doc.setFillColor(14, 30, 53); doc.rect(0, 0, 210, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(titel, 18, 22);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(107, 115, 133);
  doc.text(`${F.namn} · org.nr ${F.orgnr} · ${F.adress}, ${F.postort}`, 18, 28);
  doc.setTextColor(14, 30, 53); doc.setFontSize(10);
  const till = typ === 'moms' ? a.moms.till : f.namn;
  doc.text([`Till: ${till}`, `Reg nr: ${plate(a.reg)}`, `Skadenummer: ${a.skadenr || ''}`, typ === 'offert' ? `Datum: ${a.offert.datum}` : typ === 'faktura' ? `Fakturadatum: ${a.faktura.datum}   Förfaller: ${a.faktura.forfall}` : `Fakturadatum: ${a.moms.datum}   Förfaller: ${a.moms.forfall}`], 18, 40);
  const rows = typ === 'moms' ? [[`Moms 25 % på faktura ${a.faktura.nr} (${kr2(V.belopp(a))} kr exkl. moms)`, '1', kr2(V.momsBelopp(a)), kr2(V.momsBelopp(a))]] : (typ === 'faktura' ? a.faktura.rader : a.offert.rader).map((r: any) => [r.text, String(r.antal), kr2(r.apris), kr2(r.antal * r.apris)]);
  autoTable(doc, { startY: 64, head: [['Beskrivning', 'Antal', 'À-pris', 'Summa']], body: rows, margin: { left: 18, right: 18 }, styles: { fontSize: 9 }, headStyles: { fillColor: [247, 248, 249], textColor: [107, 115, 133] }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } });
  const y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold'); doc.text(typ === 'moms' ? `Att betala: ${kr2(V.momsBelopp(a))} kr` : `Summa exkl. moms: ${kr2(V.belopp(a))} kr`, 192, y, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(107, 115, 133);
  doc.text(typ === 'faktura' ? `Fordonsägaren är momsregistrerad. Momsen faktureras fordonsägaren separat. Bankgiro ${F.bg}.` : typ === 'moms' ? `Bankgiro ${F.bg}. Ange ${a.moms.nr} vid betalning.` : `Offerten gäller i ${F.giltighet} dagar.`, 18, y + 10);
  download(`${titel.replace(/\s+/g, '_')}_${normReg(a.reg)}.pdf`, doc.output('blob'));
}

function Fakturor({ V }: { V: any }) {
  const a = useAccount(); const nav = useNavigate();
  const F = V.arList().filter((x: any) => x.faktura).sort((x: any, y: any) => y.faktura.nr - x.faktura.nr);
  return (
    <div className="ba-table-wrap"><table className="ba-table">
      <thead><tr><th>Nr</th><th>Till</th><th>Reg nr</th><th>Datum</th><th>Förfaller</th><th className="n">Belopp</th><th>Status</th></tr></thead>
      <tbody>{F.flatMap((x: any) => [
        <tr key={x.id} className="click" onClick={() => nav({ to: '/$tenant/verkstad/arende/$id', params: { tenant: a.tenant.slug, id: x.id } })}><td className="num b">{x.faktura.nr}</td><td>{V.fors(x.forsakring).namn}</td><td className="num">{plate(x.reg)}</td><td className="num">{x.faktura.datum}</td><td className="num">{x.faktura.forfall}</td><td className="n">{kr2(V.belopp(x))}</td><td>{x.faktura.betald ? <Pill tone="ok">Betald</Pill> : V.fakStatus(x.faktura) === 'forfallen' ? <Pill tone="bad">Förfallen</Pill> : <Pill tone="warn">Ej betald</Pill>}</td></tr>,
        x.moms && <tr key={x.id + 'm'}><td className="num">{x.moms.nr}</td><td>{x.moms.till}</td><td className="num">{plate(x.reg)}</td><td className="num">{x.moms.datum}</td><td className="num">{x.moms.forfall}</td><td className="n">{kr2(V.momsBelopp(x))}</td><td>{x.moms.betald ? <Pill tone="ok">Betald</Pill> : x.moms.skickad ? <Pill tone="warn">Skickad</Pill> : <Pill tone="info">Att skicka</Pill>}</td></tr>
      ])}</tbody>
    </table></div>
  );
}

function Betalningar() {
  const { V, X } = useVerkstad(); const save = useSaveA(); const toast = useToast();
  const [tx, setTx] = useState<any[] | null>(null);
  const [val, setVal] = useState<Record<number, number>>({});
  if (!V || !X) return <Loading />;
  const read = async (files: File[]) => {
    const r = await readLocal(files[0]);
    let rows: any[] = [];
    if (r.kind === 'pdf') rows = V.txFromLines(rawLinesTol(r.rawPages));
    else if (r.bankRows) rows = parseBankRows(r.bankRows);
    else rows = V.txFromLines(String(r.text || '').split(/\r?\n/));
    if (!rows.length) { toast('Hittade inga transaktioner i filen.', { tone: 'bad' }); return; }
    setTx(rows.filter(t => t.belopp > 0)); toast(`${rows.length} transaktioner inlästa.`);
  };
  const used = new Set<string>();
  return (
    <div className="ba-stack">
      <DropZone title="Dra in bankfilen eller bankgirospecifikationen" text="Inbetalningar matchas mot öppna fakturor på skadenummer, fakturanummer och belopp. Du bekräftar." onFiles={read} accept=".pdf,.csv,.xlsx,.xls,.txt" multiple={false} />
      {tx && (!tx.length ? <EmptyState icon="bank" title="Inga inbetalningar i filen" /> : (
        <div className="ba-table-wrap"><table className="ba-table">
          <thead><tr><th>Datum</th><th>Text</th><th className="n">Belopp</th><th>Förslag</th><th /></tr></thead>
          <tbody>{tx.map((t, i) => {
            const M = V.matchTx(t, used); const pick = M[val[i] ?? 0];
            return <tr key={i}><td className="num">{t.datum}</td><td className="small">{t.text}</td><td className="n">{kr2(t.belopp)}</td>
              <td>{M.length ? <Select value={val[i] ?? 0} onChange={e => setVal({ ...val, [i]: +e.target.value })} style={{ height: 34 }} aria-label="Förslag">{M.map((g: any, j: number) => <option key={j} value={j}>{g.map((x: any) => (x.typ === 'f' ? 'Faktura ' : '') + x.nr).join(' + ')}</option>)}</Select> : <span className="small muted">Ingen öppen faktura passar</span>}</td>
              <td>{pick && <Button size="sm" variant="dark" onClick={async () => { const r = X.bokfor(t, pick); for (const x of r.arenden) await save(x); toast(r.msg); setTx(tx.filter((_, j) => j !== i)); }}>Bekräfta</Button>}</td></tr>;
          })}</tbody>
        </table></div>
      ))}
    </div>
  );
}

function Jobb({ V }: { V: any }) {
  const J = V.jobbLista();
  if (!J.length) return <EmptyState icon="brush" title="Inga utförda jobb än" />;
  return (
    <div className="ba-table-wrap"><table className="ba-table">
      <thead><tr><th>Utfört</th><th>Ärende</th><th>Reg nr</th><th>Montör</th><th className="n">Intäkt</th><th className="n">Lön (netto, uppskattad)</th><th className="n">Täckningsbidrag</th></tr></thead>
      <tbody>{J.map((a: any) => { const k = V.kalkylA(a); return <tr key={a.id}><td className="num">{V.jobbDatum(a)}</td><td className="num b">{a.id}</td><td className="num">{plate(a.reg)}</td><td>{V.utfAv(a)?.namn || ''}</td><td className="n">{kr0(k.intakt)}</td><td className="n">{kr0(k.lonB)}</td><td className="n">{kr0(k.tb)}</td></tr>; })}</tbody>
    </table></div>
  );
}

function Ekonomi({ V }: { V: any }) {
  const [ar, setAr] = useState(String(new Date().getFullYear()));
  const M = V.manadsData(ar).filter((x: any) => x.intakt || x.kost);
  return (
    <>
      <div className="ba-row" style={{ marginBottom: 12 }}><Select value={ar} onChange={e => setAr(e.target.value)} style={{ width: 120 }} aria-label="År"><option>2025</option><option>2026</option><option>2027</option></Select></div>
      {!M.length ? <EmptyState icon="bank" title={`Inget för ${ar} än`} /> : <div className="ba-table-wrap"><table className="ba-table">
        <thead><tr><th>Månad</th><th className="n">Jobb</th><th className="n">Intäkt</th><th className="n">Material</th><th className="n">Lön inkl. avgifter</th><th className="n">Underleverantör</th><th className="n">Övrigt</th><th className="n">Resultat</th></tr></thead>
        <tbody>{M.map((x: any) => <tr key={x.m}><td>{Manad(x.m)}</td><td className="n">{x.jobb}</td><td className="n">{kr0(x.intakt)}</td><td className="n">{kr0(x.material)}</td><td className="n">{kr0(x.lon)}</td><td className="n">{kr0(x.ul)}</td><td className="n">{kr0(x.ovrigt)}</td><td className="n strong">{kr0(x.res)}</td></tr>)}</tbody>
      </table></div>}
    </>
  );
}

function Bokforing({ V }: { V: any }) {
  const acc = useAccount(); const b = useBackend(); const qc = useQueryClient(); const toast = useToast();
  const P = V.perioder().slice().reverse();
  const [p, setP] = useState(V.forstaOppna() || P[0]);
  const ver = V.utkast(p); const sum = V.periodSum(ver); const w = V.varningar(p, ver); const last = V.last(p);
  const lasa = async () => {
    if (w.some((x: any) => x[0] === 'bad')) { toast('Rätta de röda punkterna innan perioden låses.', { tone: 'bad' }); return; }
    await b.setDoc(acc.tenant.id, VM, 'bokforing/' + p, { period: p, status: 'last', ver, keys: ver.map((v: any) => v.key).filter(Boolean), last: new Date().toISOString() });
    qc.invalidateQueries({ queryKey: ['documents'] }); toast(`${Manad(p)} är låst och exporterad.`);
    download(V.sieNamn(p), new Uint8Array(V.bygSie(p, ver)), 'text/plain');
  };
  return (
    <div className="pf-sidebar-layout">
      <aside className="ba-stack">
        <Select value={p} onChange={e => setP(e.target.value)} aria-label="Period">{P.map((x: string) => <option key={x} value={x}>{Manad(x)} {x.slice(0, 4)}{V.last(x) ? ' (låst)' : ''}</option>)}</Select>
        <Card><dl className="pf-kv" style={{ fontSize: 12.5 }}><div><dt>Intäkter</dt><dd>{kr0(sum.int)}</dd></div><div><dt>Kostnader</dt><dd>{kr0(sum.kost)}</dd></div><div><dt>Resultat</dt><dd>{kr0(sum.res)}</dd></div><div><dt>Moms att betala</dt><dd>{kr0(sum.moms)}</dd></div><div><dt>Bank</dt><dd>{kr0(sum.bank)}</dd></div></dl></Card>
        <Button icon="download" onClick={() => download(V.sieNamn(p), new Uint8Array(V.bygSie(p, ver)), 'text/plain')}>Exportera SIE</Button>
        {!last && <Button variant="dark" icon="lock" onClick={lasa}>Lås och exportera</Button>}
      </aside>
      <section className="ba-stack">
        {w.map((x: any, i: number) => <Banner key={i} tone={x[0] === 'info' ? 'info' : undefined}>{x[1]}</Banner>)}
        {!ver.length ? <EmptyState icon="file" title="Inga verifikationer i perioden" /> : <div className="ba-table-wrap"><table className="ba-table">
          <thead><tr><th>Ver</th><th>Datum</th><th>Text</th><th>Konton</th><th className="n">Belopp</th></tr></thead>
          <tbody>{ver.map((v: any) => <tr key={v.nr}><td className="num">A{v.nr}</td><td className="num" style={{ whiteSpace: 'nowrap' }}>{v.datum}</td><td className="small">{v.text}</td><td className="small num">{v.rader.map((r: any) => `${r.k} ${kr0(r.b)}`).join(' · ')}</td><td className="n">{kr0(v.rader.filter((r: any) => r.b > 0).reduce((s: number, r: any) => s + r.b, 0))}</td></tr>)}</tbody>
        </table></div>}
      </section>
    </div>
  );
}

function Register({ V }: { V: any }) {
  const acc = useAccount(); const b = useBackend(); const qc = useQueryClient(); const toast = useToast();
  const [f, setF] = useState({ namn: '', epost: '' });
  const [o, setO] = useState({ reg: '', agare: '', epost: '' });
  const put = async (path: string, data: any, msg: string) => { await b.setDoc(acc.tenant.id, VM, path, data); qc.invalidateQueries({ queryKey: ['documents'] }); toast(msg); };
  return (
    <div className="pf-two">
      <Card title="Försäkringsbolag">
        <ul className="pf-list-plain small" style={{ display: 'grid', gap: 6, marginBottom: 12 }}>{V.forsList().map((x: any) => <li key={x.id}><b>{x.namn}</b> <span className="muted">{x.epost}</span></li>)}</ul>
        <div className="ba-grid ba-grid--2"><TextField label="Namn" value={f.namn} onChange={e => setF({ ...f, namn: e.target.value })} /><TextField label="E-post" value={f.epost} onChange={e => setF({ ...f, epost: e.target.value })} /></div>
        <div style={{ marginTop: 10 }}><Button variant="dark" onClick={() => { if (!f.namn.trim()) return; const id = f.namn.toLowerCase().replace(/[^a-z0-9]+/g, '-'); put('forsakring/' + id, { id, namn: f.namn.trim(), epost: f.epost.trim(), kort: f.namn.trim()[0] }, 'Försäkringsbolaget är tillagt.'); setF({ namn: '', epost: '' }); }}>Lägg till</Button></div>
      </Card>
      <Card title="Fordon och ägare">
        <ul className="pf-list-plain small" style={{ display: 'grid', gap: 6, marginBottom: 12 }}>{[...V.S.fordon.values()].map((x: any) => <li key={x.reg || x.id}><b className="num">{plate(x.reg || x.id)}</b> {x.agare} <span className="muted">{x.epost}</span></li>)}</ul>
        <div className="ba-grid ba-grid--3"><TextField label="Reg nr" mono value={o.reg} onChange={e => setO({ ...o, reg: e.target.value })} /><TextField label="Fordonsägare" value={o.agare} onChange={e => setO({ ...o, agare: e.target.value })} /><TextField label="E-post" value={o.epost} onChange={e => setO({ ...o, epost: e.target.value })} /></div>
        <div style={{ marginTop: 10 }}><Button variant="dark" onClick={() => { const r = normReg(o.reg); if (!r) return; put('fordon/' + r, { id: r, reg: r, agare: o.agare.trim(), epost: o.epost.trim() }, 'Fordonet är sparat.'); setO({ reg: '', agare: '', epost: '' }); }}>Spara</Button></div>
      </Card>
    </div>
  );
}

function Inst({ V }: { V: any }) {
  const acc = useAccount(); const b = useBackend(); const qc = useQueryClient(); const toast = useToast();
  const [F, setF] = useState({ ...V.foretag() });
  const [P, setP] = useState(JSON.parse(JSON.stringify(V.priser())));
  const put = async (path: string, data: any) => { await b.setDoc(acc.tenant.id, VM, path, data); qc.invalidateQueries({ queryKey: ['documents'] }); toast('Sparat.'); };
  return (
    <div className="ba-stack">
      <Card title="Företaget" actions={<Button size="sm" variant="dark" onClick={() => put('installningar/foretag', F)}>Spara</Button>}>
        <div className="ba-grid ba-grid--3">{[['namn', 'Namn'], ['orgnr', 'Org.nr'], ['momsnr', 'Momsnr'], ['adress', 'Adress'], ['postort', 'Postnummer och ort'], ['epost', 'E-post'], ['bg', 'Bankgiro'], ['villkorDagar', 'Betalningsvillkor (dagar)'], ['giltighet', 'Offert giltig (dagar)']].map(([k, l]) => <TextField key={k} label={l} value={F[k] ?? ''} onChange={e => setF({ ...F, [k]: e.target.value })} />)}</div>
      </Card>
      <Card title="Prislista" actions={<Button size="sm" variant="dark" onClick={() => put('installningar/priser', { items: P })}>Spara</Button>}>
        <div className="ba-table-wrap"><table className="ba-table"><thead><tr><th>Arbete</th><th className="n">Vanlig bil</th><th className="n">Större bil</th><th className="n">Meter folie, vanlig</th><th className="n">Meter folie, större</th></tr></thead>
          <tbody>{P.map((p: any, i: number) => <tr key={p.id}><td>{p.text}</td>{['vanlig', 'storre', 'mv', 'ms'].map(k => <td key={k} className="n"><Input mono value={p[k] ?? ''} style={{ height: 32, width: 90 }} aria-label={k} onChange={e => setP(P.map((x: any, j: number) => j === i ? { ...x, [k]: +e.target.value || 0 } : x))} /></td>)}</tr>)}</tbody></table></div>
      </Card>
    </div>
  );
}

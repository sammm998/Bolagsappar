// Adminportalen (sidan 43). En del av plattformen som bara Bolagsappar ser. Siffrorna räknas i packages/core/admin.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Banner, Button, Card, EmptyState, Icon, Kpi, Logo, Modal, Pill, Progress, Select, TextField, useToast } from '@bolagsappar/ui';
import { kundlista, konton, leveranser, modulStatistik, fastnar, guiderAvslutade } from '@bolagsappar/core/admin';
import { MODULES } from '@bolagsappar/modules';
import { GUIDES, guideFor } from '@bolagsappar/guides';
import { initialer } from '@bolagsappar/core/format';
import { useSession } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { Loading } from '../../shell/Shell';

const opt = { staleTime: 30_000 };
function useAdmin() {
  const b = useBackend();
  const tenants = useQuery<any[]>({ queryKey: ['tenants', 'alla'], queryFn: () => b.allTenants(), ...opt });
  const licenses = useQuery<any[]>({ queryKey: ['licenses', 'alla'], queryFn: () => b.allLicenses(), ...opt });
  const progress = useQuery<any[]>({ queryKey: ['guide_progress', 'alla'], queryFn: () => b.guideStats(), ...opt });
  const tickets = useQuery<any[]>({ queryKey: ['support_tickets', 'alla'], queryFn: () => b.tickets(), ...opt });
  const bookings = useQuery<any[]>({ queryKey: ['bookings'], queryFn: () => b.bookings(), ...opt });
  const loading = [tenants, licenses, progress, tickets, bookings].some(q => q.isLoading);
  const checklists = useMemo(() => Object.fromEntries(Object.entries(GUIDES).map(([m, vs]) => [m, Object.fromEntries(Object.entries(vs as any).map(([v, g]: any) => [v, g.checklist || []]))])), []);
  return { tenants: tenants.data || [], licenses: licenses.data || [], progress: progress.data || [], tickets: tickets.data || [], bookings: bookings.data || [], checklists, loading };
}
const pct = (x: number | null) => x == null ? '' : Math.round(x * 100) + ' %';
const MNAMN = (k: string) => MODULES.find((m: any) => m.key === k)?.name || k;

// ------------------------------------------------ skal
const NAV: [string, string, string][] = [['', 'grid', 'Översikt'], ['kunder', 'building', 'Kunder'], ['moduler', 'layers', 'Moduler'], ['fakturering', 'receipt', 'Fakturering'], ['support', 'help', 'Support']];
const CRUMB: Record<string, string> = { '': 'Översikt', kunder: 'Kunder', moduler: 'Moduler', fakturering: 'Fakturering', support: 'Support', arbetsdagar: 'Arbetsdagar', guider: 'Guider' };

export function AdminShell() {
  const { user, accounts, loading } = useSession(); const nav = useNavigate();
  const path = useRouterState({ select: s => s.location.pathname });
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => { if (!loading && !user) nav({ to: '/logga-in' }); }, [loading, user, nav]);
  const A = useAdmin();
  if (loading) return <Loading />;
  if (!accounts.some(a => a.tenant.type === 'platform')) return <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh', padding: 16 }}><div className="ba-card ba-card--pad" style={{ maxWidth: 420 }}><h1 className="pf-h1">Bara för Bolagsappar</h1><p className="pf-lead">Adminportalen syns bara för Bolagsappars egna konton.</p><p><Link className="ba-btn ba-btn--dark" to="/valj-bolag">Välj bolag</Link></p></div></div>;
  const sub = path.replace(/^\/admin\/?/, '').split('/')[0];
  const cnt: Record<string, number> = { kunder: A.tenants.filter(t => t.type === 'main' || t.type === 'direct').length, moduler: MODULES.length, support: A.tickets.filter(t => t.status !== 'lost').length };
  const Item = ({ to, icon, children, count }: { to: string; icon: string; children: ReactNode; count?: number }) => {
    const full = '/admin' + (to ? '/' + to : ''); const active = to ? path.startsWith(full) : path === '/admin' || path === '/admin/';
    return <Link to={full} activeOptions={{ exact: true }} aria-current={active ? 'page' : undefined}><Icon name={icon} />{children}{count ? <span className="cnt">{count}</span> : null}</Link>;
  };
  return (
    <div className="pf">
      {open && <div className="pf-scrim" onClick={() => setOpen(false)} />}
      <aside className={'pf-side' + (open ? ' pf-side--open' : '')} aria-label="Meny">
        <div className="pf-acct" style={{ cursor: 'default' }}><Avatar text="BA" accent="#0E1E35" color="#fff" /><span className="ba-grow"><b>Bolagsappar</b><small>Superadmin</small></span></div>
        <nav className="pf-nav" aria-label="Adminmeny" style={{ marginTop: 8 }}>
          {NAV.map(([k, i, l]) => <Item key={k} to={k} icon={i} count={cnt[k]}>{l}</Item>)}
          <div className="pf-nav-sec">Leverans</div>
          <Item to="arbetsdagar" icon="calendar" count={A.bookings.filter(b => b.status !== 'klar').length}>Arbetsdagar</Item>
          <Item to="guider" icon="book">Guider</Item>
        </nav>
        <div className="pf-side-foot pf-nav">
          {accounts.filter(a => a.tenant.type !== 'platform').slice(0, 1).map(a => <Link key={a.tenant.id} to="/$tenant" params={{ tenant: a.tenant.slug }}><Icon name="arrow" />Till {a.tenant.name}</Link>)}
          <div className="pf-powered">Drivs av <Logo size={11} /></div>
        </div>
      </aside>
      <div className="pf-main">
        <header className="pf-top">
          <Button className="pf-burger" variant="secondary" size="sm" icon="menu" aria-label="Öppna menyn" onClick={() => setOpen(true)} />
          <nav className="pf-crumbs ba-grow" aria-label="Du är här"><Link to="/admin">Bolagsappar</Link><span aria-hidden>/</span><b>{CRUMB[sub] || ''}</b></nav>
          <Avatar text={initialer(user?.name || '')} round />
        </header>
        <main className="pf-content" id="innehall">{A.loading ? <Loading /> : <Outlet />}</main>
      </div>
    </div>
  );
}

function Head({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return <div className="pf-head"><div className="ba-grow"><h1 className="pf-h1">{title}</h1>{lead && <p className="pf-lead">{lead}</p>}</div>{children}</div>;
}

// ------------------------------------------------ översikt
export function Oversikt() {
  const A = useAdmin(); const [ny, setNy] = useState(false);
  const K = konton(A.tenants), L = leveranser(A.tenants);
  const F = fastnar(A.licenses, A.progress, A.checklists).filter(x => x.fastnar > 0).slice(0, 5);
  const done = guiderAvslutade(A.licenses, A.progress, A.checklists);
  const titel = (x: any) => `${MNAMN(x.modul)}: ${x.titel.charAt(0).toLowerCase() + x.titel.slice(1)}`;
  return (
    <>
      <Head title="Översikt" lead="Alla kunder, moduler och leveranser."><Button variant="primary" icon="plus" onClick={() => setNy(true)}>Ny kund</Button></Head>
      <div className="ba-grid ba-grid--4" style={{ marginBottom: 16 }}>
        <Kpi label="Månadsintäkt" value="[MRR] kr" sub="alla aktiva licenser" />
        <Kpi label="Konton" value={K.totalt} sub={`${K.main} huvudkunder, ${K.sub} underkunder, ${K.direct} direkt`} />
        <Kpi label="Leveranser" value={L.length} sub={L.map(l => l.status === 'bygger' ? `${l.namn} dag ${l.dag}` : `${l.namn} arbetsdag`).join(', ') || 'inga pågående'} />
        <Kpi label="Guider avslutade" value={pct(done) || 'Ingen data'} sub="av konton som påbörjat en guide" />
      </div>
      <div className="pf-sidebar-layout pf-sidebar-layout--right">
        <Kundtabell A={A} />
        <Card title="Var fastnar användarna?" headExtra={<span className="small muted">Guidesteg som flest inte klarar</span>}>
          {!F.length ? <EmptyState icon="check" title="Ingen fastnar just nu" /> : <ul className="pf-list-plain" style={{ display: 'grid', gap: 12 }}>{F.map(x => (
            <li key={x.modul + x.variant + x.steg}><div className="ba-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><span className="small">{titel(x)}</span><b className="num" style={{ whiteSpace: 'nowrap' }}>{pct(x.fastnar)}</b></div>
              <div style={{ marginTop: 6 }}><Progress value={x.fastnar} label={`${pct(x.fastnar)} har inte klarat steget`} /></div>
              <div className="small muted" style={{ marginTop: 4 }}>{x.klar} av {x.startat} konton klara</div></li>))}</ul>}
          <div style={{ marginTop: 12 }}><Link className="ba-btn ba-btn--sm" to="/admin/guider">Alla guider</Link></div>
        </Card>
      </div>
      {ny && <NyKund onClose={() => setNy(false)} />}
    </>
  );
}

function Kundtabell({ A, alla }: { A: any; alla?: boolean }) {
  const K = kundlista(A.tenants, A.licenses, MODULES as any);
  const [q, setQ] = useState('');
  const L = K.filter(k => !q || k.namn.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="ba-stack">
      {alla && <div className="pf-filters" style={{ marginTop: 0 }}><label className="pf-searchbox" style={{ marginLeft: 0 }}><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Sök kund" aria-label="Sök kund" /></label></div>}
      <div className="ba-table-wrap"><table className="ba-table">
        <thead><tr><th>Kund</th><th>Typ</th><th>Underkunder</th><th>Moduler</th><th>Status</th></tr></thead>
        <tbody>{L.map(k => <tr key={k.id}><td className="b">{k.namn}</td><td>{k.typ}</td><td>{k.typ === 'Huvudkund' ? (k.underkunder ? `${k.underkunder} ${k.ord}` : '[antal]') : ''}</td><td className="small">{k.moduler.join(', ')}</td><td><Pill tone={k.ton as any}>{k.status}</Pill></td></tr>)}</tbody>
      </table></div>
    </div>
  );
}

function NyKund({ onClose }: { onClose: () => void }) {
  const b = useBackend(); const qc = useQueryClient(); const toast = useToast();
  const [f, setF] = useState({ name: '', type: 'main', org_nr: '' });
  const go = async () => {
    if (!f.name.trim()) return;
    try { await b.createTenant({ name: f.name.trim(), type: f.type, org_nr: f.org_nr.trim() || null, slug: f.name.trim().toLowerCase().replace(/å|ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), settings: { status: 'bygger', dag: 1, dagar: 14 } }); qc.invalidateQueries({ queryKey: ['tenants'] }); toast(`${f.name} är skapad. Leveransen startar på dag 1.`); onClose(); }
    catch (e: any) { toast(e.message, { tone: 'bad' }); }
  };
  return (
    <Modal open onClose={onClose} title="Ny kund" labelledBy="nk-h" footer={<><Button onClick={onClose}>Avbryt</Button><Button variant="primary" onClick={go}>Skapa</Button></>}>
      <div className="ba-stack">
        <TextField label="Företagsnamn" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <TextField label="Organisationsnummer" mono value={f.org_nr} onChange={e => setF({ ...f, org_nr: e.target.value })} />
        <label className="ba-field"><span className="ba-label">Typ</span><Select value={f.type} onChange={e => setF({ ...f, type: e.target.value })}><option value="main">Huvudkund (har underkunder)</option><option value="direct">Direktkund</option></Select></label>
        <p className="small muted" style={{ margin: 0 }}>Kunden bjuder sedan in sina användare. Underkunder bjuds in av huvudkunden.</p>
      </div>
    </Modal>
  );
}

export function Kunder() {
  const A = useAdmin(); const [ny, setNy] = useState(false);
  const subs = A.tenants.filter(t => t.type === 'sub');
  return (
    <>
      <Head title="Kunder" lead="Huvudkunder och direktkunder. Underkunder hör till sin huvudkund."><Button variant="primary" icon="plus" onClick={() => setNy(true)}>Ny kund</Button></Head>
      <Kundtabell A={A} alla />
      <Card tone="subtle" className="pf-section"><p className="small" style={{ margin: 0 }}>{subs.length} underkunder totalt. Bolagsappar ser inte kundernas data. Supporten ser ett konto bara när kunden har gett tillgång under Inställningar, och allt som görs då loggas hos kunden.</p></Card>
      {ny && <NyKund onClose={() => setNy(false)} />}
    </>
  );
}

// ------------------------------------------------ moduler
export function Moduler() {
  const A = useAdmin();
  const S = modulStatistik(MODULES as any, A.licenses);
  return (
    <>
      <Head title="Moduler" lead="Varje app är en modul med manifest, motor i packages/core och guider per variant." />
      <div className="ba-table-wrap"><table className="ba-table">
        <thead><tr><th>Modul</th><th>Version</th><th className="n">Konton</th><th>Varianter i bruk</th><th>Varianter</th><th>Status</th></tr></thead>
        <tbody>{S.map(m => <tr key={m.key}><td className="b">{m.namn}</td><td className="num">{m.version}</td><td className="n">{m.konton}</td><td className="num">{m.varianter.join(', ')}</td><td className="small muted">{m.alla.join(', ')}</td><td>{m.status === 'kommer' ? <Pill tone="info">Kommer snart</Pill> : m.status === 'ny' ? <Pill tone="warn">Ny</Pill> : <Pill tone="ok">Släppt</Pill>}</td></tr>)}</tbody>
      </table></div>
    </>
  );
}

// ------------------------------------------------ fakturering
export function Fakturering() {
  const A = useAdmin();
  const betalare = [...new Set(A.licenses.filter(l => l.status === 'aktiv').map(l => l.paid_by))];
  const namn = (id: string) => A.tenants.find(t => t.id === id)?.name || id;
  return (
    <>
      <Head title="Fakturering" lead="Fast månadspris per licens. Den som betalar för licensen faktureras." />
      <Banner tone="info">Priserna är inte satta än ([PRIS]). Fakturor skapas när betalleverantören är vald, se öppna frågor.</Banner>
      <div className="ba-table-wrap" style={{ marginTop: 14 }}><table className="ba-table">
        <thead><tr><th>Betalare</th><th>Licenser</th><th className="n">Antal</th><th className="n">Per månad</th></tr></thead>
        <tbody>{betalare.map(p => { const L = A.licenses.filter(l => l.paid_by === p && l.status === 'aktiv'); const per: Record<string, number> = {}; L.forEach(l => { per[MNAMN(l.module_key)] = (per[MNAMN(l.module_key)] || 0) + 1; });
          return <tr key={p}><td className="b">{namn(p)}</td><td className="small">{Object.entries(per).map(([k, n]) => `${k} ${n}`).join(', ')}</td><td className="n">{L.length}</td><td className="n">[PRIS]</td></tr>; })}</tbody>
      </table></div>
    </>
  );
}

// ------------------------------------------------ support
export function Support() {
  const A = useAdmin(); const b = useBackend(); const qc = useQueryClient(); const toast = useToast();
  const sorted = [...A.tickets].sort((x, y) => ({ ny: 0, vantar: 1, lost: 2 } as any)[x.status] - ({ ny: 0, vantar: 1, lost: 2 } as any)[y.status] || y.created_at.localeCompare(x.created_at));
  const set = async (id: string, s: string) => { await b.setTicket(id, s); qc.invalidateQueries({ queryKey: ['support_tickets'] }); toast('Ärendet är uppdaterat.'); };
  const ST: Record<string, [string, any]> = { ny: ['Ny', 'warn'], vantar: ['Väntar', 'info'], lost: ['Löst', 'ok'] };
  return (
    <>
      <Head title="Support" lead="Frågor från kunderna. Svara i e-post, markera status här." />
      {!sorted.length ? <EmptyState icon="help" title="Inga supportärenden" /> : <div className="ba-table-wrap"><table className="ba-table">
        <thead><tr><th>Status</th><th>Kund</th><th>Ärende</th><th>Inkom</th><th /></tr></thead>
        <tbody>{sorted.map(t => <tr key={t.id}><td><Pill tone={ST[t.status][1]}>{ST[t.status][0]}</Pill></td><td className="b">{t.tenant?.name}</td><td>{t.subject}</td><td className="num small">{String(t.created_at).slice(0, 10)}</td>
          <td><div className="ba-row" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>{t.status !== 'vantar' && t.status !== 'lost' && <Button size="sm" onClick={() => set(t.id, 'vantar')}>Väntar på kund</Button>}{t.status !== 'lost' ? <Button size="sm" variant="dark" onClick={() => set(t.id, 'lost')}>Löst</Button> : <Button size="sm" variant="link" onClick={() => set(t.id, 'ny')}>Öppna igen</Button>}</div></td></tr>)}</tbody>
      </table></div>}
    </>
  );
}

// ------------------------------------------------ arbetsdagar
export function Arbetsdagar() {
  const A = useAdmin(); const b = useBackend(); const qc = useQueryClient(); const toast = useToast();
  const L = leveranser(A.tenants);
  const set = async (id: string, patch: any, msg: string) => { await b.setBooking(id, patch); qc.invalidateQueries({ queryKey: ['bookings'] }); toast(msg); };
  return (
    <>
      <Head title="Arbetsdagar" lead="Bokningar från hemsidan och pågående leveranser. En arbetsdag på plats, sedan bygger vi på 14 dagar." />
      <div className="pf-two">
        <Card title="Bokningar">
          {!A.bookings.length ? <EmptyState icon="calendar" title="Inga bokningar" /> : <ul className="pf-list-plain" style={{ display: 'grid', gap: 12 }}>{A.bookings.map(x => (
            <li key={x.id} className="ba-card ba-card--pad" style={{ padding: 14 }}>
              <div className="ba-row" style={{ justifyContent: 'space-between' }}><b>{x.foretag}</b>{x.status === 'ny' ? <Pill tone="warn">Ny</Pill> : x.status === 'bokad' ? <Pill tone="info">Bokad {x.dag}</Pill> : <Pill tone="ok">Klar</Pill>}</div>
              <div className="small muted">{x.namn} · {x.epost}{x.bransch ? ' · ' + x.bransch : ''} · inkom {String(x.created_at).slice(0, 10)}</div>
              {x.fritext && <p className="small" style={{ margin: '6px 0 0' }}>{x.fritext}</p>}
              <div className="ba-row" style={{ marginTop: 10 }}>
                {x.status === 'ny' && <BokaDag onSave={d => set(x.id, { status: 'bokad', dag: d }, `Arbetsdagen är bokad ${d}.`)} />}
                {x.status === 'bokad' && <Button size="sm" variant="dark" onClick={() => set(x.id, { status: 'klar' }, 'Markerad som genomförd.')}>Genomförd</Button>}
              </div>
            </li>))}</ul>}
        </Card>
        <Card title="Leveranser">
          {!L.length ? <EmptyState icon="package" title="Inga pågående leveranser" /> : <ul className="pf-list-plain" style={{ display: 'grid', gap: 14 }}>{L.map(l => (
            <li key={l.id}><div className="ba-row" style={{ justifyContent: 'space-between' }}><b>{l.namn}</b><span className="small muted">{l.typ}</span></div>
              {l.status === 'bygger' ? <><div style={{ marginTop: 6 }}><Progress value={l.dag || 0} max={l.dagar} label={`Dag ${l.dag} av ${l.dagar}`} /></div><div className="small muted" style={{ marginTop: 4 }}>Bygger, dag {l.dag} av {l.dagar}</div></>
                : <div className="small muted">Arbetsdag {l.datum}</div>}
            </li>))}</ul>}
        </Card>
      </div>
    </>
  );
}
function BokaDag({ onSave }: { onSave: (d: string) => void }) {
  const [d, setD] = useState('');
  return <><input type="date" className="ba-input" style={{ width: 170, height: 34 }} value={d} onChange={e => setD(e.target.value)} aria-label="Datum för arbetsdagen" /><Button size="sm" variant="dark" disabled={!d} onClick={() => onSave(d)}>Boka arbetsdag</Button></>;
}

// ------------------------------------------------ guider
export function Guider() {
  const A = useAdmin();
  const F = fastnar(A.licenses, A.progress, A.checklists);
  const [sel, setSel] = useState<string>('kassan/sub');
  const [m, v] = sel.split('/');
  const g = guideFor(m, v, { central: 'Taxi Malmö' });
  const rows = F.filter(x => x.modul === m && x.variant === v);
  return (
    <>
      <Head title="Guider" lead="Välkomstguide, Kom igång och hjälp per vy för varje modul och variant. Statistiken visar var användarna fastnar." />
      <div className="ba-row" style={{ marginBottom: 14 }}>{Object.entries(GUIDES).flatMap(([mk, vs]) => Object.keys(vs as any).map(vk => <button key={mk + vk} className="ba-chip" aria-pressed={sel === mk + '/' + vk} onClick={() => setSel(mk + '/' + vk)}>{MNAMN(mk)} · {vk}</button>))}</div>
      {g && <div className="pf-two">
        <Card title="Kom igång" headExtra={<span className="small muted">{rows[0] ? `${rows[0].startat} konton har påbörjat` : 'Ingen har påbörjat än'}</span>}>
          {!g.checklist?.length ? <p className="small muted" style={{ margin: 0 }}>Ingen checklista för den här varianten.</p> : <ol className="pf-list-plain" style={{ display: 'grid', gap: 10 }}>{g.checklist.map((c: any, i: number) => { const r = rows.find(x => x.steg === c.key); return (
            <li key={c.key} className="ba-row" style={{ flexWrap: 'nowrap' }}><span className="ba-step__n" style={{ flex: 'none' }}>{i + 1}</span><span className="ba-grow"><b className="small">{c.title}</b><div className="small muted">{c.sub}</div></span>{r && <span className="num small">{r.klar} av {r.startat}</span>}</li>); })}</ol>}
        </Card>
        <Card title="Välkomstguide">
          <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>{(g.welcome || []).map((w: any, i: number) => <li key={i} className="small"><b>{w.title}.</b> {w.body}</li>)}</ol>
          <h3 className="pf-h3" style={{ marginTop: 16 }}>Hjälp per vy</h3>
          <dl className="small" style={{ margin: 0, display: 'grid', gap: 6 }}>{Object.entries(g.help || {}).map(([k, h]: any) => <div key={k}><dt className="b">{h.title} <span className="muted num">({k})</span></dt><dd style={{ margin: 0 }}>{h.body}</dd></div>)}</dl>
        </Card>
      </div>}
    </>
  );
}

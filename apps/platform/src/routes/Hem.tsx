// Hem (sidan 27 och 35). Det viktigaste just nu med knapp direkt till nästa steg, kom igång-listan och apparna.
import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { AppIcon, Button, Card, Checklist, Icon, Kpi, Pill, btnClass, type ChecklistItem } from '@bolagsappar/ui';
import { guideFor } from '@bolagsappar/guides';
import { krs, kr2, manad, Manad, manadAr, veckodagDatum, tal, dagText } from '@bolagsappar/core/format';
import { useAccount, useSession } from '../lib/session';
import { useAccountGuide, useDoc, useDocs, useLicenses, useNetwork, useOffers, useSharesTo, useChildLicenses, useNotifications } from '../lib/q';
import { useFileStatus, useLastPublished, useMonths, useWorkingPeriod, kortNamn, listText } from '../lib/avr';
import { myApps } from '../lib/apps';
import { usePage } from '../shell/Help';
import { createVerkstad } from '@bolagsappar/core/verkstad';

const halsning = () => { const h = new Date().getHours(); return h < 10 ? 'God morgon' : h < 17 ? 'Hej' : 'God kväll'; };
const fornamn = (n?: string) => String(n || '').split(' ')[0];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Hem() {
  const a = useAccount();
  usePage({ crumbs: ['Hem'] }, [a.tenant.id]);
  if (a.isDriver) return <HemForare />;
  if (a.tenant.type === 'main') return <HemMain />;
  if (a.tenant.type === 'sub') return <HemSub />;
  return <HemDirect />;
}

function Header({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return <div className="pf-head"><div className="ba-grow"><h1 className="pf-h1">{title}</h1><p className="pf-lead" style={{ fontSize: 12.5 }}>{sub}</p></div>{action}</div>;
}

function HemMain() {
  const a = useAccount(); const { user } = useSession(); const t = a.tenant.id;
  const period = useWorkingPeriod(t);
  const fs = useFileStatus(t, period);
  const last = useLastPublished(t);
  const { months } = useMonths(t);
  const net = useNetwork(t, 'avrakning', last?.period || null);
  const fl = useDoc<any>(t, 'forarlista', 'lista');
  const kids = useChildLicenses(t);
  const lic = useLicenses(t);
  const prog = useAccountGuide(t, 'avrakning');
  const lastSum = last ? months[last.period]?.summary : null;
  const betalt = lastSum ? -lastSum.bolag.filter((b: any) => b.att < 0).reduce((s: number, b: any) => s + b.att, 0) : null;
  const n = net.data?.length ?? 0, oppnat = (net.data || []).filter(x => x.opened_at).length;
  const aktiva = (fl.data?.forare || []).filter((f: any) => f.status === 'aktiv').length;
  const kassan = (kids.data || []).filter(l => l.module_key === 'kassan' && l.status === 'aktiv').length;
  const akarOrd = a.tenant.brand?.akarOrd === 'underleverantör' ? 'underleverantörer' : 'åkare';

  const guide = guideFor('avrakning', 'main');
  const done = new Set((prog.data || []).map(x => x.step_key));
  const items: ChecklistItem[] = (guide?.checklist || []).filter((c: any) => c.key !== 'priser').map((c: any) => ({ key: c.key, title: c.title, sub: c.sub, done: done.has(c.key), href: '/' + a.tenant.slug + '/' + c.to }));
  const allDone = items.every(i => i.done);
  const apps = myApps(a.tenant.type, lic.data || []);
  const missing = fs.missing.map(m => kortNamn(m.key));
  const rest = missing.length ? `${cap(listText(missing))} saknas.` : 'Alla filer är inlästa.';

  return (
    <>
      <Header title={`${halsning()}, ${fornamn(user?.name)}`} sub={`${veckodagDatum()} · ${a.tenant.name}`} action={a.canWrite && <Link className={btnClass('secondary')} to="/$tenant/akare" params={{ tenant: a.tenant.slug }} search={{ bjud: 1 } as any}><Icon name="plus" />Bjud in {akarOrd === 'åkare' ? 'åkare' : 'underleverantör'}</Link>} />
      {period && (
        <div className="pf-next" style={{ marginBottom: 16 }}>
          <span className="pf-next__icon"><Icon name="receipt" size={18} /></span>
          <div className="ba-grow" style={{ minWidth: 0 }}>
            <small>Avräkning {manad(period)}</small>
            <strong>{fs.loading ? 'Hämtar…' : `${fs.done} av ${fs.total} filer är inlästa. ${rest}`}</strong>
            <div className="ba-progress ba-progress--on-navy" style={{ maxWidth: 380, marginTop: 8 }}><span style={{ width: (fs.done / fs.total * 100) + '%' }} /></div>
          </div>
          <Link className={btnClass('secondary')} to="/$tenant/avrakning/$period/filer" params={{ tenant: a.tenant.slug, period }}>Fortsätt <Icon name="arrow" size={14} /></Link>
        </div>
      )}
      <div className="ba-grid ba-grid--4">
        <Kpi label={`Betalt till ${akarOrd}, ${last ? manad(last.period) : 'förra månaden'}`} value={betalt == null ? '' : krs(betalt)} sub={last ? `Publicerat ${String(last.published_at || '').slice(0, 10)}` : 'Inget publicerat än'} />
        <Kpi label={akarOrd === 'åkare' ? 'Åkare' : 'Underleverantörer'} value={tal(n)} sub={last ? `${oppnat} har öppnat ${manad(last.period)}s avräkning` : ''} />
        <Kpi label="Aktiva förare" value={tal(aktiva)} sub="enligt Förarlista" />
        <Kpi label="Åkare med Åkarkassan" value={`${kassan} av ${n}`} sub="tillval, åkaren betalar själv" subTone="ok" />
      </div>
      <div className="pf-two pf-section">
        {!allDone ? (
          <Card title="Kom igång med plattformen" headExtra={<Pill tone="ok" dot={false}>{items.filter(i => i.done).length} av {items.length}</Pill>}>
            <div className="ba-progress" style={{ marginBottom: 6 }}><span style={{ width: items.filter(i => i.done).length / items.length * 100 + '%' }} /></div>
            <Checklist items={items} renderLink={(it, ch) => <Link to={it.href!}>{ch}</Link>} />
          </Card>
        ) : (
          <Card title="Senast">
            <ul className="pf-list-plain small" style={{ display: 'grid', gap: 8 }}>
              {last && <li>{manadAr(last.period)} publicerades {String(last.published_at || '').slice(0, 10)}.</li>}
              <li>{oppnat} av {n} {akarOrd} har öppnat avräkningen.</li>
            </ul>
          </Card>
        )}
        <Card title="Mina appar">
          <div className="pf-apps">
            {apps.map(x => (
              <Link key={x.key} className="pf-app" to={'/' + a.tenant.slug + '/' + x.path}>
                <AppIcon icon={x.icon} tone={x.tone} /><b>{x.name}</b>
                <small>{x.key === 'avrakning' ? (period ? `${Manad(period)} pågår` : '') : x.key === 'forarlista' ? (fl.data ? 'Uppdaterad ' + (String(fl.data.hamtad).slice(0, 10) === new Date().toISOString().slice(0, 10) ? 'i dag' : String(fl.data.hamtad).slice(0, 10)) : 'Koppla TaxiCaller') : ''}</small>
              </Link>
            ))}
            <Link className="pf-app pf-app--ghost" to="/$tenant/appar-till-akare" params={{ tenant: a.tenant.slug }}><AppIcon icon="wallet" tone="blue" /><b>Åkarkassan</b><small>Erbjuds till {akarOrd}</small></Link>
            <Link className="pf-app pf-app--ghost" to="/$tenant/appbutik" params={{ tenant: a.tenant.slug }}><AppIcon icon="plus" tone="blue" /><b>Appbutik</b><small>Fler appar</small></Link>
          </div>
        </Card>
      </div>
    </>
  );
}

function HemSub() {
  const a = useAccount(); const { user } = useSession(); const t = a.tenant.id;
  const shares = useSharesTo(t, 'avrakning');
  const lic = useLicenses(t);
  const harKassan = (lic.data || []).some(l => l.module_key === 'kassan' && l.status === 'aktiv');
  const latest = shares.data?.[0];
  const p = latest?.payload;
  return (
    <>
      <Header title={`Hej ${fornamn(user?.name)}`} sub={`${a.tenant.name} · åkare hos ${a.parent?.name || ''}`} />
      {latest ? (
        <div className="pf-next pf-next--green" style={{ marginBottom: 16 }}>
          <span className="pf-next__icon"><Icon name="receipt" size={18} /></span>
          <div className="ba-grow"><small>Ny avräkning från {latest.payload.fran}</small><strong>{p.meddelande}</strong></div>
          <Link className={btnClass('secondary')} to="/$tenant/min-avrakning/$period" params={{ tenant: a.tenant.slug, period: latest.period }}>Visa avräkningen <Icon name="arrow" size={14} /></Link>
        </div>
      ) : (
        <div className="pf-next" style={{ marginBottom: 16 }}><span className="pf-next__icon"><Icon name="clock" size={18} /></span><div className="ba-grow"><small>Min avräkning</small><strong>Ingen avräkning publicerad än. Du får en notis när {a.parent?.name} publicerar.</strong></div></div>
      )}
      <div className="pf-two">
        {harKassan ? <KassanKort period={latest?.period} /> : <Card title="Min avräkning"><SubSummary payload={p} /></Card>}
        <KomIgangSub harKassan={harKassan} />
      </div>
    </>
  );
}

function SubSummary({ payload: p }: { payload: any }) {
  if (!p) return <p className="muted small">Här ser du din del av centralens avräkning när den är publicerad.</p>;
  return <dl className="pf-kv">{p.sammanfattning.map((r: any) => <div key={r.key}><dt>{r.text}</dt><dd>{kr2(r.belopp)} kr</dd></div>)}<div className="tot"><dt>{p.riktning === 'betalar' ? 'Att betala' : 'Att få'}</dt><dd>{kr2(p.belopp)} kr</dd></div></dl>;
}

function KassanKort({ period }: { period?: string }) {
  const a = useAccount(); const t = a.tenant.id;
  const m = useDoc<any>(t, 'kassan', period ? 'm-' + period : undefined);
  const shares = useSharesTo(t, 'avrakning');
  const sh = shares.data?.find(s => s.period === period);
  const bro = (sh?.payload?.passager?.bro || []).filter((x: any) => x.typ === 'bro').length, stu = (sh?.payload?.passager?.stu || []).length;
  const harLdl = !!m.data?.ldl;
  const kvar = (harLdl ? 0 : 1);
  if (!period) return <Card title="Åkarkassan"><p className="muted small">Väntar på första avräkningen från centralen.</p></Card>;
  return (
    <Card title={`Åkarkassan, ${manad(period)}`} headExtra={kvar ? <Pill tone="warn" dot={false}>{kvar} sak kvar</Pill> : <Pill tone="ok">Klart</Pill>}>
      <div className="ba-stack" style={{ gap: 8 }}>
        <Row ok title={`Avräkning från ${a.parent?.name}`} sub={sh ? `Hämtad automatiskt ${String(sh.created_at).slice(0, 10)}` : 'Väntar'} />
        <Row ok title="Bro och Sturup" sub={`${bro + stu} passager för dina ${sh?.payload?.bilar?.length || ''} bilar, hämtat`} />
        <Row ok={harLdl} title="Löneunderlag från Megtax (LDL)" sub={harLdl ? 'Inläst' : 'Dra in filen för att räkna lönen'} />
        {!harLdl && <div><Link className={btnClass('primary', 'sm')} to="/$tenant/akarkassan/$period/oversikt" params={{ tenant: a.tenant.slug, period }}><Icon name="upload" size={14} />Ladda upp LDL</Link></div>}
      </div>
    </Card>
  );
}
function Row({ ok, title, sub }: { ok?: boolean; title: string; sub: string }) {
  return <div className={'ba-file' + (ok ? '' : ' ba-file--missing')} style={{ minHeight: 52, padding: '8px 12px' }}><span className="ba-file__icon"><Icon name={ok ? 'check' : 'upload'} size={14} /></span><div><div className="ba-file__title" style={{ fontSize: 12.5 }}>{title}</div><div className="ba-file__sub" style={{ fontSize: 11 }}>{sub}</div></div></div>;
}

function KomIgangSub({ harKassan }: { harKassan: boolean }) {
  const a = useAccount(); const t = a.tenant.id;
  const settings = useDoc<any>(harKassan ? t : undefined, 'kassan', 'settings');
  const skatt = useDoc<any>(harKassan ? t : undefined, 'kassan', 'skatt');
  const months = useDocs<any>(harKassan ? t : undefined, 'kassan', '');
  const prog = useAccountGuide(t, harKassan ? 'kassan' : 'avrakning');
  const done = new Set((prog.data || []).map(x => x.step_key));
  const items: ChecklistItem[] = harKassan ? [
    { key: 'logga-in', title: 'Logga in', sub: 'Med e-postlänken', done: true },
    { key: 'forare', title: 'Lägg till dina förare', sub: 'Namn, personnummer och bankkonto', done: Object.keys(settings.data?.forare || {}).length > 0 || done.has('forare'), href: `/${a.tenant.slug}/akarkassan` },
    { key: 'skatt', title: 'Läs in skattetabellen', sub: 'Fil från Skatteverket, en gång per år', done: !!skatt.data || done.has('skatt'), href: `/${a.tenant.slug}/akarkassan` },
    { key: 'forsta-lon', title: 'Gör första lönen', sub: 'Guiden visar varje steg', done: (months.data || []).some(d => d.data?.lonekorning) || done.has('forsta-lon'), href: `/${a.tenant.slug}/akarkassan` }
  ] : (guideFor('avrakning', 'sub')?.checklist || []).map((c: any) => ({ key: c.key, title: c.title, sub: c.sub, done: c.auto || done.has(c.key), href: `/${a.tenant.slug}/${c.to}` }));
  const n = items.filter(i => i.done).length;
  if (n === items.length) return <Card title="Allt är klart"><p className="small muted">Du har gjort allt i kom igång-listan.</p></Card>;
  return (
    <Card title="Kom igång" headExtra={<Pill tone="ok" dot={false}>{n} av {items.length}</Pill>}>
      <div className="ba-progress" style={{ marginBottom: 6 }}><span style={{ width: n / items.length * 100 + '%' }} /></div>
      <Checklist items={items} renderLink={(it, ch) => <Link to={it.href!}>{ch}</Link>} />
    </Card>
  );
}

function HemDirect() {
  const a = useAccount(); const { user } = useSession(); const t = a.tenant.id;
  const lic = useLicenses(t);
  const apps = myApps(a.tenant.type, lic.data || []);
  const docs = useDocs<any>(apps.some(x => x.key === 'verkstad') ? t : undefined, 'verkstad', 'arenden');
  const todo = useMemo(() => {
    if (!docs.data) return [];
    const S = { arenden: new Map(docs.data.map(d => [d.id, structuredClone(d.data)])), fordon: new Map(), forsakring: new Map(), kostnader: new Map(), bokforing: new Map(), lonespec: new Map(), inst: {} };
    return createVerkstad({ S }).attGora();
  }, [docs.data]);
  return (
    <>
      <Header title={`${halsning()}, ${fornamn(user?.name)}`} sub={`${veckodagDatum()} · ${a.tenant.name}`} />
      {todo[0] && (
        <div className="pf-next" style={{ marginBottom: 16 }}>
          <span className="pf-next__icon"><Icon name="brush" size={18} /></span>
          <div className="ba-grow"><small>Verkstad · nästa steg</small><strong>{todo[0].h}</strong><small>{todo[0].s}</small></div>
          <Link className={btnClass('secondary')} to="/$tenant/verkstad/arende/$id" params={{ tenant: a.tenant.slug, id: todo[0].a.id }}>{todo[0].btn} <Icon name="arrow" size={14} /></Link>
        </div>
      )}
      <div className="pf-two">
        <Card title="Att göra" headExtra={<span className="muted small">{todo.length} punkter</span>}>
          <ul className="pf-list-plain" style={{ display: 'grid', gap: 8 }}>
            {todo.slice(0, 6).map((x: any) => <li key={x.a.id + x.h}><Link to="/$tenant/verkstad/arende/$id" params={{ tenant: a.tenant.slug, id: x.a.id }} style={{ textDecoration: 'none', display: 'flex', gap: 10, alignItems: 'center' }}><Pill tone={x.sev === 'bad' ? 'bad' : x.sev === 'warn' ? 'warn' : 'info'} dot={false}>{x.a.reg}</Pill><span className="small ba-grow">{x.h}</span><Icon name="right" size={14} /></Link></li>)}
            {!todo.length && <li className="muted small">Inget att göra just nu.</li>}
          </ul>
        </Card>
        <Card title="Mina appar">
          <div className="pf-apps">
            {apps.map(x => <Link key={x.key} className="pf-app" to={'/' + a.tenant.slug + '/' + x.path}><AppIcon icon={x.icon} tone={x.tone} /><b>{x.name}</b><small>{x.key === 'verkstad' ? `${(docs.data || []).length} ärenden` : ''}</small></Link>)}
            <Link className="pf-app pf-app--ghost" to="/$tenant/appbutik" params={{ tenant: a.tenant.slug }}><AppIcon icon="plus" tone="blue" /><b>Appbutik</b><small>Fler appar</small></Link>
          </div>
        </Card>
      </div>
    </>
  );
}

function HemForare() {
  const a = useAccount(); const { user } = useSession(); const t = a.tenant.id;
  const months = useDocs<any>(t, 'kassan', '');
  const notis = useNotifications(t);
  const specs = (months.data || []).filter(d => /^m-\d{4}-\d\d$/.test(d.id) && d.data?.lonekorning?.rader?.[a.forare_id || '']).sort((x, y) => y.id.localeCompare(x.id));
  const avtal = (months.data || []).find(d => d.id === 'avtal-' + a.forare_id);
  const v = avtal?.data?.versioner?.[avtal.data.versioner.length - 1];
  const vantar = v && !v.sign?.anst;
  const senaste = specs[0];
  const L = senaste?.data.lonekorning.rader[a.forare_id!];
  return (
    <>
      <Header title={`Hej ${fornamn(user?.name)}`} sub={`${a.tenant.name} · förare`} />
      {vantar && (
        <div className="pf-next pf-next--green" style={{ marginBottom: 16 }}>
          <span className="pf-next__icon"><Icon name="pencil" size={18} /></span>
          <div className="ba-grow"><small>Väntar på din signatur</small><strong>Anställningsavtal från {a.tenant.name}</strong></div>
          <Link className={btnClass('secondary')} to="/$tenant/avtal" params={{ tenant: a.tenant.slug }}>Läs och signera <Icon name="arrow" size={14} /></Link>
        </div>
      )}
      <div className="pf-two">
        <Card title={senaste ? `Lönespec ${manad(senaste.id.slice(2))}` : 'Lönespec'}>
          {L ? (
            <>
              <dl className="pf-kv"><div><dt>Bruttolön</dt><dd>{kr2(L.brutto)}</dd></div><div><dt>Skatt</dt><dd>{kr2(-L.skatt)}</dd></div>{L.kontant ? <div><dt>Kontanter kvittade</dt><dd>{kr2(-L.kontant)}</dd></div> : null}<div className="tot"><dt>Att utbetala</dt><dd>{kr2(L.netto)}</dd></div></dl>
              <p className="small muted">Utbetalas {senaste.data.lonekorning.utb}.</p>
              <Link className={btnClass('secondary', 'sm')} to="/$tenant/lonespec" params={{ tenant: a.tenant.slug }}>Alla lönespecar</Link>
            </>
          ) : <p className="small muted">Ingen lönespec än. Den kommer när åkeriet har godkänt lönen.</p>}
        </Card>
        <Card title="Notiser">
          <ul className="pf-list-plain small" style={{ display: 'grid', gap: 8 }}>{(notis.data || []).slice(0, 5).map(n => <li key={n.id}><b>{n.title}</b><div className="muted">{n.body}</div></li>)}{!notis.data?.length && <li className="muted">Inga notiser.</li>}</ul>
        </Card>
      </div>
    </>
  );
}
export { dagText };

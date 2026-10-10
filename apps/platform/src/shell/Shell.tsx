// Samma skal för alla kunder (sidan 27): kontoväljare, meny byggd från apparna, sök, "Så funkar det", notiser.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { Avatar, Icon, Logo, Button } from '@bolagsappar/ui';
import { useSession, typText, ROLLNAMN, AccountProvider, toAccountCtx, useAccount, type Account } from '../lib/session';
import { useLicenses, useNotifications, useNetwork, useOffers } from '../lib/q';
import { myApps } from '../lib/apps';
import { HelpProvider, useHelpState, HelpPanel } from './Help';
import { initialer } from '@bolagsappar/core/format';

export function TenantShell() {
  const { tenant: slug } = useParams({ strict: false }) as { tenant: string };
  const { accounts, loading, user } = useSession();
  const nav = useNavigate();
  const acc = accounts.find(a => a.tenant.slug === slug);
  useEffect(() => { if (!loading && !user) nav({ to: '/logga-in' }); }, [loading, user, nav]);
  if (loading) return <Loading />;
  if (!acc) return <NoAccess />;
  return (
    <AccountProvider value={toAccountCtx(acc)}>
      <HelpProvider>
        <Frame><Outlet /></Frame>
      </HelpProvider>
    </AccountProvider>
  );
}

export function Loading() {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }} aria-busy="true"><div className="ba-row muted"><Icon name="refresh" />Laddar…</div></div>;
}
function NoAccess() {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh', padding: 16 }}><div className="ba-card ba-card--pad" style={{ maxWidth: 420 }}><h1 className="pf-h1">Du har inte tillgång</h1><p className="pf-lead">Kontot finns inte eller så har du inte behörighet. Välj ett av dina bolag.</p><p><Link className="ba-btn ba-btn--dark" to="/valj-bolag">Välj bolag</Link></p></div></div>;
}

function Frame({ children }: { children: ReactNode }) {
  const a = useAccount();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: s => s.location.pathname });
  useEffect(() => setOpen(false), [path]);
  const help = useHelpState();
  return (
    <div className="pf">
      {open && <div className="pf-scrim" onClick={() => setOpen(false)} />}
      <aside className={'pf-side' + (open ? ' pf-side--open' : '')} aria-label="Meny">
        <Sidebar />
      </aside>
      <div className="pf-main">
        <TopBar onMenu={() => setOpen(true)} />
        {help.open ? (
          <div className="pf-with-panel">
            <main className="pf-content" id="innehall">{children}</main>
            <HelpPanel />
          </div>
        ) : <main className="pf-content" id="innehall">{children}</main>}
      </div>
    </div>
  );
}

function AccountSwitcher() {
  const a = useAccount(); const { accounts, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const f = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, []);
  const brand = a.tenant.brand || {};
  return (
    <div ref={ref}>
      <button className="pf-acct" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Avatar text={brand.initialer || initialer(a.tenant.name)} accent={brand.accent} color={brand.text} />
        <span className="ba-grow" style={{ minWidth: 0 }}><b>{a.tenant.name}</b><small>{a.tenant.type === 'sub' && a.parent ? `Åkare hos ${a.parent.name}` : typText(a)}</small></span>
        <Icon name="down" size={15} />
      </button>
      {open && (
        <div className="pf-acct-menu" role="menu">
          {accounts.map((x: Account) => (
            <Link key={x.tenant.id} to="/$tenant" params={{ tenant: x.tenant.slug }} role="menuitem" onClick={() => setOpen(false)}>
              <Avatar size="sm" text={x.tenant.brand?.initialer || initialer(x.tenant.name)} accent={x.tenant.brand?.accent} color={x.tenant.brand?.text} />
              <span className="ba-grow"><b style={{ fontSize: 13 }}>{x.tenant.name}</b><small className="muted" style={{ display: 'block', fontSize: 11 }}>{typText(x)} · {ROLLNAMN[x.role]}</small></span>
              {x.tenant.id === a.tenant.id && <Icon name="check" size={14} />}
            </Link>
          ))}
          {accounts.some(x => x.tenant.type === 'platform') && <Link to="/admin" role="menuitem"><Icon name="grid" />Adminportalen</Link>}
          <button role="menuitem" onClick={() => signOut()}><Icon name="logout" />Logga ut</button>
        </div>
      )}
    </div>
  );
}

function NavLink({ to, icon, tone, children, count, exact }: { to: string; icon: string; tone?: string; children: ReactNode; count?: ReactNode; exact?: boolean }) {
  const a = useAccount();
  const path = useRouterState({ select: s => s.location.pathname });
  const full = '/' + a.tenant.slug + (to ? '/' + to : '');
  const active = exact ? path === full || path === full + '/' : path === full || path.startsWith(full + '/');
  return (
    <Link to={full} activeOptions={{ exact: true }} aria-current={active ? 'page' : undefined}>
      {tone ? <span className={'ba-appicon ba-appicon--sm ba-appicon--' + tone}><Icon name={icon} size={13} /></span> : <Icon name={icon} />}
      {children}{count != null && <span className={'cnt' + (typeof count === 'string' ? ' cnt--new' : '')}>{count}</span>}
    </Link>
  );
}

function Sidebar() {
  const a = useAccount();
  const lic = useLicenses(a.tenant.id);
  const apps = useMemo(() => myApps(a.tenant.type, lic.data || []), [a.tenant.type, lic.data]);
  const net = useNetwork(a.tenant.type === 'main' && a.canWrite ? a.tenant.id : undefined);
  const parentOffers = useOffers(a.tenant.type === 'sub' ? a.tenant.parent_id : null);
  const nya = a.tenant.type === 'sub' ? (parentOffers.data || []).filter(o => o.mode !== 'av' && !(lic.data || []).some(l => l.module_key === o.module_key)).length + 1 : 0;
  if (a.isDriver) return (
    <>
      <AccountSwitcher />
      <nav className="pf-nav" aria-label="Huvudmeny" style={{ marginTop: 8 }}>
        <NavLink to="" icon="home" exact>Hem</NavLink>
        <NavLink to="lonespec" icon="file">Lönespecar</NavLink>
        <NavLink to="avtal" icon="pencil">Avtal</NavLink>
      </nav>
      <SideFoot />
    </>
  );
  return (
    <>
      <AccountSwitcher />
      <nav className="pf-nav" aria-label="Huvudmeny" style={{ marginTop: 8 }}>
        <NavLink to="" icon="home" exact>Hem</NavLink>
        {apps.length > 0 && <div className="pf-nav-sec">Mina appar</div>}
        {apps.map(x => <NavLink key={x.key} to={x.path} icon={x.icon} tone={x.tone}>{x.name}</NavLink>)}
        {a.tenant.type === 'main' && (
          <>
            <div className="pf-nav-sec">Nätverk</div>
            <NavLink to="akare" icon="truck" count={net.data?.length}>{a.tenant.brand?.akarOrd === 'underleverantör' ? 'Underleverantörer' : 'Åkare'}</NavLink>
            <NavLink to="appar-till-akare" icon="layers">{a.tenant.brand?.akarOrd === 'underleverantör' ? 'Appar till underleverantörer' : 'Appar till åkare'}</NavLink>
          </>
        )}
        <div className="pf-nav-sec">Konto</div>
        <NavLink to="appbutik" icon="plus" count={nya ? `${nya} nya` : undefined}>Appbutik</NavLink>
        <NavLink to="installningar" icon="settings">Inställningar</NavLink>
      </nav>
      <SideFoot />
    </>
  );
}
function SideFoot() {
  const a = useAccount();
  return (
    <div className="pf-side-foot pf-nav">
      <NavLink to="hjalp" icon="book">Hjälp och guider</NavLink>
      <div className="pf-powered">Drivs av <Logo size={11} /></div>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const a = useAccount(); const { user } = useSession();
  const help = useHelpState();
  const crumbs = help.crumbs;
  const notis = useNotifications(a.tenant.id);
  const unread = (notis.data || []).filter(n => !n.read_at).length;
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { const f = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search.current?.focus(); } }; document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, []);
  return (
    <header className="pf-top">
      <Button className="pf-burger" variant="secondary" size="sm" icon="menu" aria-label="Öppna menyn" onClick={onMenu} />
      <nav className="pf-crumbs ba-grow" aria-label="Du är här">
        <Link to="/$tenant" params={{ tenant: a.tenant.slug }}>{a.tenant.name}</Link>
        {(crumbs.length ? crumbs : ['Hem']).map((c: string, i: number, L: string[]) => <span key={i} style={{ display: 'contents' }}><span aria-hidden>/</span>{i === L.length - 1 ? <b>{c}</b> : <span>{c}</span>}</span>)}
      </nav>
      <form className="pf-search" role="search" onSubmit={e => { e.preventDefault(); if (q.trim()) nav({ to: '/$tenant/sok', params: { tenant: a.tenant.slug }, search: { q } as any }); }}>
        <Icon name="search" size={14} /><input ref={search} value={q} onChange={e => setQ(e.target.value)} placeholder="Sök" aria-label="Sök" /><span className="ba-kbd">⌘K</span>
      </form>
      {help.available && <Button variant="soft" size="sm" icon="question" onClick={() => help.toggle()} aria-expanded={help.open}>Så funkar det</Button>}
      <Link to="/$tenant/notiser" params={{ tenant: a.tenant.slug }} className="ba-btn ba-btn--sm ba-btn--icon" aria-label={unread ? `Notiser, ${unread} olästa` : 'Notiser'} style={{ position: 'relative' }}>
        <Icon name="bell" size={15} />{unread > 0 && <span style={{ position: 'absolute', top: 5, right: 6, width: 7, height: 7, borderRadius: 4, background: 'var(--bad-dot)' }} />}
      </Link>
      <Avatar text={initialer(user?.name || user?.email || '')} round />
    </header>
  );
}

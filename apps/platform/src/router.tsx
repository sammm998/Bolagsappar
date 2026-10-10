import { createRootRoute, createRoute, createRouter, Outlet, Navigate, lazyRouteComponent, Link } from '@tanstack/react-router';
import { Login } from './routes/Login';
import { TenantShell } from './shell/Shell';
import { useSession } from './lib/session';
import { homeFor } from './routes/Login';

const L = (f: () => Promise<any>, name: string) => lazyRouteComponent(f, name);

function Start() {
  const s = useSession();
  if (s.loading) return null;
  if (!s.user) return <Navigate to="/logga-in" />;
  if (s.accounts.length === 1) return <Navigate to={homeFor(s.accounts[0])} />;
  return <Navigate to="/valj-bolag" />;
}
function NotFound() {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh', padding: 16 }}><div style={{ textAlign: 'center' }}><h1 className="pf-h1">Sidan finns inte</h1><p className="pf-lead">Länken kan vara gammal.</p><p><Link className="ba-btn ba-btn--dark" to="/">Till startsidan</Link></p></div></div>;
}

const root = createRootRoute({ component: () => <Outlet />, notFoundComponent: NotFound });
const r = (path: string, component: any, parent: any = root) => createRoute({ getParentRoute: () => parent, path, component });

const index = r('/', Start);
const login = r('logga-in', () => <Login />);
const pick = r('valj-bolag', () => <Login pick />);
const invite = r('inbjudan/$token', L(() => import('./routes/konto/Inbjudan'), 'Inbjudan'));

const admin = r('admin', L(() => import('./routes/admin/Admin'), 'AdminShell'));
const adminRoutes = [
  r('/', L(() => import('./routes/admin/Admin'), 'Oversikt'), admin),
  r('kunder', L(() => import('./routes/admin/Admin'), 'Kunder'), admin),
  r('moduler', L(() => import('./routes/admin/Admin'), 'Moduler'), admin),
  r('fakturering', L(() => import('./routes/admin/Admin'), 'Fakturering'), admin),
  r('support', L(() => import('./routes/admin/Admin'), 'Support'), admin),
  r('arbetsdagar', L(() => import('./routes/admin/Admin'), 'Arbetsdagar'), admin),
  r('guider', L(() => import('./routes/admin/Admin'), 'Guider'), admin)
];

const tenant = r('$tenant', TenantShell);
const avrPeriod = r('avrakning/$period', L(() => import('./routes/avrakning/Layout'), 'AvrakningLayout'), tenant);
const tenantRoutes = [
  r('/', L(() => import('./routes/Hem'), 'Hem'), tenant),
  r('akare', L(() => import('./routes/natverk/Akare'), 'Akare'), tenant),
  r('appar-till-akare', L(() => import('./routes/natverk/ApparTillAkare'), 'ApparTillAkare'), tenant),
  r('appbutik', L(() => import('./routes/konto/Appbutik'), 'Appbutik'), tenant),
  r('installningar', L(() => import('./routes/konto/Installningar'), 'Installningar'), tenant),
  r('notiser', L(() => import('./routes/konto/Notiser'), 'Notiser'), tenant),
  r('hjalp', L(() => import('./routes/konto/Hjalp'), 'Hjalp'), tenant),
  r('sok', L(() => import('./routes/konto/Sok'), 'Sok'), tenant),
  r('avrakning', L(() => import('./routes/avrakning/Layout'), 'AvrakningStart'), tenant),
  r('avrakning/historik', L(() => import('./routes/avrakning/Historik'), 'Historik'), tenant),
  r('avrakning/installningar', L(() => import('./routes/avrakning/Installningar'), 'AvrInstallningar'), tenant),
  avrPeriod,
  r('forarlista', L(() => import('./routes/forarlista/Forarlista'), 'Forarlista'), tenant),
  r('mina-forare', L(() => import('./routes/forarlista/Forarlista'), 'MinaForare'), tenant),
  r('min-avrakning', L(() => import('./routes/sub/MinAvrakning'), 'MinAvrakning'), tenant),
  r('min-avrakning/$period', L(() => import('./routes/sub/MinAvrakning'), 'MinAvrakning'), tenant),
  r('akarkassan', L(() => import('./routes/kassan/Kassan'), 'KassanStart'), tenant),
  r('akarkassan/$period', L(() => import('./routes/kassan/Kassan'), 'Kassan'), tenant),
  r('akarkassan/$period/$tab', L(() => import('./routes/kassan/Kassan'), 'Kassan'), tenant),
  r('verkstad', L(() => import('./routes/verkstad/Verkstad'), 'Verkstad'), tenant),
  r('verkstad/$tab', L(() => import('./routes/verkstad/Verkstad'), 'Verkstad'), tenant),
  r('verkstad/arende/$id', L(() => import('./routes/verkstad/Verkstad'), 'Arende'), tenant),
  r('skadeflode', L(() => import('./routes/skadeflode/Skadeflode'), 'Skadeflode'), tenant),
  r('korjournal', L(() => import('./routes/konto/Appbutik'), 'Kommer'), tenant),
  r('lonespec', L(() => import('./routes/forare/Forare'), 'Lonespecar'), tenant),
  r('avtal', L(() => import('./routes/forare/Forare'), 'Avtal'), tenant)
];
const avrSteps = ['filer', 'kontroll', 'godkann', 'publicera'].map(s => r(s, L(() => import('./routes/avrakning/Steps'), { filer: 'Filer', kontroll: 'Kontroll', godkann: 'Godkann', publicera: 'Publicera' }[s]!), avrPeriod));

const tree = root.addChildren([index, login, pick, invite, admin.addChildren(adminRoutes), tenant.addChildren([...tenantRoutes.filter(x => x !== avrPeriod), avrPeriod.addChildren(avrSteps)])]);
export const router = createRouter({ routeTree: tree, defaultPreload: 'intent', scrollRestoration: true });

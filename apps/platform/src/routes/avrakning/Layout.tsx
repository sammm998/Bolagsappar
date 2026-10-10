// Avräkning för huvudkunden: rubrik, stegvisare (Filer, Kontroll, Godkänn, Publicera) och exempelläge.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, Outlet, useNavigate, useParams, useRouterState, useSearch } from '@tanstack/react-router';
import { Banner, Button, Icon, Steps, type StepItem } from '@bolagsappar/ui';
import { manadAr, Manad } from '@bolagsappar/core/format';
import { useAccount } from '../../lib/session';
import { useWorkingPeriod, UPLOADS } from '../../lib/avr';
import { MonthProvider, useMonthModel } from './model';
import { usePage, useWelcome } from '../../shell/Help';
import { Loading } from '../../shell/Shell';
import { GEMENSAMT } from '@bolagsappar/guides';

export function AvrakningStart() {
  const a = useAccount();
  const p = useWorkingPeriod(a.tenant.id);
  if (a.tenant.type !== 'main') return <Navigate to="/$tenant/min-avrakning" params={{ tenant: a.tenant.slug }} />;
  if (!p) return <Loading />;
  return <Navigate to="/$tenant/avrakning/$period/filer" params={{ tenant: a.tenant.slug, period: p }} search={(s: any) => s} />;
}

const ActCtx = createContext<HTMLElement | null>(null);
/** Varje steg lägger sina knappar i rubrikraden. */
export function StepActions({ children }: { children: ReactNode }) {
  const el = useContext(ActCtx);
  return el ? createPortal(children, el) : null;
}

const STEG = [['filer', 'Filer'], ['kontroll', 'Kontroll'], ['godkann', 'Godkänn'], ['publicera', 'Publicera']] as const;

export function AvrakningLayout() {
  const a = useAccount(); const nav = useNavigate();
  const { period } = useParams({ strict: false }) as { period: string };
  const search = useSearch({ strict: false }) as { exempel?: number | string };
  const exempel = !!search.exempel;
  const step = useRouterState({ select: s => s.location.pathname.split('/').pop() || 'filer' });
  const m = useMonthModel(period, exempel);
  const [actions, setActions] = useState<HTMLElement | null>(null);
  useWelcome('avrakning', 'main');
  usePage({ crumbs: ['Avräkning', Manad(period)], module: 'avrakning', variant: 'main', view: step === 'publicera' ? 'publicera' : step, steps: step === 'filer' ? [
    { title: 'Dra in allt du har', sub: 'Ordningen spelar ingen roll.', done: m.runs.length > 0 },
    { title: 'Läs sammanfattningen', sub: 'Stämmer antal körningar och bilar?', done: m.runs.length > 0 },
    { title: 'Hämta det som saknas', sub: 'Klicka "Var hittar jag filen?" på raden.', done: m.runs.length >= UPLOADS.length }
  ] : undefined }, [period, step, m.runs.length]);
  useEffect(() => {
    const f = () => nav({ to: '/$tenant/avrakning/$period/filer', params: { tenant: a.tenant.slug, period }, search: { exempel: 1 } as any });
    window.addEventListener('ba:exempel', f); return () => window.removeEventListener('ba:exempel', f);
  }, [nav, a.tenant.slug, period]);
  if (a.tenant.type !== 'main') return <Navigate to="/$tenant/min-avrakning" params={{ tenant: a.tenant.slug }} />;

  const required = UPLOADS.filter(u => u.kravs).every(u => m.runs.some((r: any) => r.kind === u.key));
  const stateOf = (k: string): StepItem['state'] => {
    if (k === step) return 'current';
    if (k === 'filer') return required ? 'done' : 'todo';
    if (k === 'kontroll' || k === 'godkann') return m.status !== 'oppen' ? 'done' : 'todo';
    return m.status === 'publicerad' ? 'done' : 'todo';
  };
  const items: StepItem[] = STEG.map(([k, l]) => ({ key: k, label: l, state: stateOf(k), href: k }));
  return (
    <MonthProvider value={m}>
      <ActCtx.Provider value={actions}>
        {exempel && <div style={{ marginBottom: 14 }}><Banner action={<Link className="ba-btn ba-btn--sm" to="/$tenant/avrakning/$period/filer" params={{ tenant: a.tenant.slug, period }} search={{}}>Avsluta exempelläget</Link>}>{GEMENSAMT.exempelBanner}</Banner></div>}
        <div className="pf-head" style={{ alignItems: 'center' }}>
          <div><div className="pf-eyebrow">Avräkning · <Link to="/$tenant/avrakning/historik" params={{ tenant: a.tenant.slug }}>Historik</Link> · <Link to="/$tenant/avrakning/installningar" params={{ tenant: a.tenant.slug }}>Inställningar</Link></div><h1 className="pf-h1">{manadAr(period)}</h1></div>
          <Steps items={items} renderLink={(s, ch, cls) => <Link to={'/' + a.tenant.slug + '/avrakning/' + period + '/' + s.key} search={exempel ? { exempel: 1 } : {}} className={cls} aria-current={s.state === 'current' ? 'step' : undefined}>{ch}</Link>} />
          <span className="ba-grow" />
          <div className="ba-row" ref={setActions} />
        </div>
        {m.version > 1 && m.status !== 'publicerad' && <div style={{ marginBottom: 14 }}><Banner tone="info">Rättelse, version {m.version}. Den publicerade versionen ligger kvar hos åkarna tills du publicerar den nya.</Banner></div>}
        {m.loading ? <Loading /> : <Outlet />}
      </ActCtx.Provider>
    </MonthProvider>
  );
}

export function useStepNav() {
  const a = useAccount(); const nav = useNavigate();
  const search = useSearch({ strict: false }) as any;
  const { period } = useParams({ strict: false }) as { period: string };
  return (step: string, p = period) => nav({ to: '/$tenant/avrakning/$period/' + step, params: { tenant: a.tenant.slug, period: p }, search: search.exempel ? { exempel: 1 } : {} } as any);
}
export { Button, Icon };

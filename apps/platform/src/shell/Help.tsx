// Guidesystemet (sidan 16): välkomstguide, kom igång-lista, hjälppanel per steg och filhjälp.
// Innehållet kommer från guidemanifestet (@bolagsappar/guides) så att texterna kan skrivas om utan att röra koden.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Icon, Modal, Progress } from '@bolagsappar/ui';
import { guideFor, GEMENSAMT } from '@bolagsappar/guides';
import { fil } from '@bolagsappar/core/filetypes';
import { useAccount } from '../lib/session';
import { useBackend } from '../lib/backend';
import { useGuide } from '../lib/q';

interface PageState { crumbs: string[]; module?: string; variant?: string; view?: string; fileHelp?: { app: string; key: string } | null; steps?: { title: string; sub: string; done?: boolean }[]; progress?: { done: number; total: number; label: string } | null; extra?: ReactNode }
interface Ctx { page: PageState; setPage: (p: PageState) => void; open: boolean; setOpen: (o: boolean) => void; showFile: (app: string, key: string) => void; welcome: { module: string; variant: string } | null; openWelcome: (m: string, v: string) => void; closeWelcome: () => void }
const C = createContext<Ctx | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<PageState>({ crumbs: [] });
  const [open, setOpen] = useState<boolean>(() => { try { return localStorage.getItem('ba:help') === '1'; } catch { return false; } });
  const [welcome, setWelcome] = useState<Ctx['welcome']>(null);
  const setO = useCallback((o: boolean) => { setOpen(o); try { localStorage.setItem('ba:help', o ? '1' : '0'); } catch {} }, []);
  const showFile = useCallback((app: string, key: string) => { setPage(p => ({ ...p, fileHelp: { app, key } })); setO(true); }, [setO]);
  const v = useMemo(() => ({ page, setPage, open, setOpen: setO, showFile, welcome, openWelcome: (module: string, variant: string) => setWelcome({ module, variant }), closeWelcome: () => setWelcome(null) }), [page, open, setO, showFile, welcome]);
  return <C.Provider value={v}>{children}{welcome && <WelcomeGuide {...welcome} onClose={() => setWelcome(null)} />}</C.Provider>;
}
export function useHelpCtx() { const c = useContext(C); if (!c) throw new Error('HelpProvider saknas'); return c; }
export function useHelpState() {
  const c = useHelpCtx();
  return { open: c.open, available: !!c.page.module, toggle: () => c.setOpen(!c.open), crumbs: c.page.crumbs };
}

/** Sidan berättar var användaren står: brödsmulor och vilken hjälp som gäller. */
export function usePage(p: PageState, deps: unknown[] = []) {
  const c = useHelpCtx();
  useEffect(() => { c.setPage({ fileHelp: null, ...p }); /* eslint-disable-next-line */ }, deps);
}

/** Visar välkomstguiden första gången appen öppnas (per användare). */
export function useWelcome(module: string, variant: string) {
  const a = useAccount(); const c = useHelpCtx();
  const g = useGuide(a.tenant.id, module);
  useEffect(() => {
    if (!g.data || a.isDriver) return;
    if (!g.data.some(x => x.step_key === 'welcome')) c.openWelcome(module, variant);
    // eslint-disable-next-line
  }, [g.data, module, variant]);
}

function WelcomeGuide({ module, variant, onClose }: { module: string; variant: string; onClose: () => void }) {
  const a = useAccount(); const b = useBackend(); const qc = useQueryClient();
  const g = guideFor(module, variant, { central: a.central.replace(/ AB$/, '') });
  const [i, setI] = useState(0);
  if (!g) return null;
  const card = g.welcome[i], last = i === g.welcome.length - 1;
  const done = async (exempel = false) => {
    try { await b.setGuideStep(a.tenant.id, module, 'welcome', true); qc.invalidateQueries({ queryKey: ['guide_progress'] }); } catch {}
    onClose();
    if (exempel) window.dispatchEvent(new CustomEvent('ba:exempel', { detail: { module } }));
  };
  return (
    <Modal open onClose={() => done()} labelledBy="welcome-h" wide dark>
      <div className="pf-welcome">
        <small>Välkommen till {g.title} · {i + 1} av {g.welcome.length}</small>
        <h2 id="welcome-h">{card.title}</h2>
        <p>{card.body}</p>
        {card.steg && <div className="pf-welcome__steps">{card.steg.map((s: any) => <div key={s.title}><span><Icon name={s.icon} size={14} /></span><b>{s.title}</b><small>{s.sub}</small></div>)}</div>}
      </div>
      <div className="pf-welcome-foot">
        <div className="pf-dots" aria-hidden>{g.welcome.map((_: any, k: number) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <span className="ba-grow" />
        {i === 0 && ((module === 'avrakning' && variant === 'main') || module === 'kassan') && <Button variant="link" onClick={() => done(true)}>{GEMENSAMT.exempel}</Button>}
        <Button onClick={() => done()}>Hoppa över</Button>
        <Button variant="primary" iconRight="arrow" onClick={() => last ? done() : setI(i + 1)}>{last ? 'Kom igång' : 'Nästa'}</Button>
      </div>
    </Modal>
  );
}

/** Hjälppanelen till höger. Visar hjälp för just den vy man står i och filhjälpen. */
export function HelpPanel() {
  const c = useHelpCtx(); const a = useAccount();
  const p = c.page;
  if (!p.module) return null;
  const g = guideFor(p.module, p.variant || 'main', { central: a.central.replace(/ AB$/, '') });
  const h = g?.help?.[p.view || ''] || null;
  const f = p.fileHelp ? fil(p.fileHelp.app, p.fileHelp.key) : null;
  return (
    <aside className="pf-panel" aria-label="Guide">
      <div className="pf-panel__head">
        <div className="ba-row" style={{ fontSize: 11.5, opacity: .85 }}><Icon name="book" size={14} />Guide<span className="ba-grow" /><button className="ba-btn ba-btn--sm ba-btn--icon pf-drawer-close" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }} aria-label="Stäng guiden" onClick={() => c.setOpen(false)}><Icon name="x" size={14} /></button></div>
        <h2>{h?.title || g?.title}</h2>
        {h?.body && <p>{h.body}</p>}
        {p.progress && <div style={{ marginTop: 12 }}><div className="ba-row" style={{ fontSize: 11.5, opacity: .85, marginBottom: 6 }}>{p.progress.label}<span className="ba-grow" />{Math.round(p.progress.done / (p.progress.total || 1) * 100)} %</div><Progress onNavy value={p.progress.done} max={p.progress.total} label={p.progress.label} /></div>}
      </div>
      <div className="pf-panel__body">
        {(p.steps || h?.punkter) && (
          <ol className="pf-help-steps">
            {(p.steps || (h.punkter as string[][]).map(([title, sub]) => ({ title, sub }))).map((s: any, i: number) => (
              <li key={s.title}><span className={'n' + (s.done ? ' ok' : '')}>{s.done ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}</span><span><b>{s.title}</b><small>{s.sub}</small></span></li>
            ))}
          </ol>
        )}
        {f && (
          <div className="pf-where">
            <h3>Var hittar jag filen?</h3>
            <b className="small">{f.label} ({f.format})</b>
            <ol>{f.hjalp.steg.map((s: string) => <li key={s}>{s}</li>)}</ol>
            <div className="ba-row" style={{ gap: 6 }}>{(f.hjalp.taggar || [f.hjalp.nar]).map((t: string) => <span key={t} className="ba-pill ba-pill--info" style={{ height: 24 }}>{t}</span>)}</div>
          </div>
        )}
        {p.extra}
        <Button variant="link" icon="eye" onClick={() => c.openWelcome(p.module!, p.variant || 'main')}>Visa välkomstguiden igen</Button>
      </div>
    </aside>
  );
}

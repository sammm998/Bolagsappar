import { useCallback, useEffect, useRef, useState, createContext, useContext, type ReactNode, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';
import { Button, cx } from './basics';

/* ---------- Stegvisare ---------- */
export interface StepItem { key: string; label: string; state: 'done' | 'current' | 'todo'; href?: string; onClick?: () => void }
export function Steps({ items, renderLink }: { items: StepItem[]; renderLink?: (s: StepItem, children: ReactNode, cls: string) => ReactNode }) {
  return (
    <ol className="ba-steps" aria-label="Steg">
      {items.map((s, i) => {
        const cls = cx('ba-step', 'ba-step--' + s.state);
        const inner = <><span className="ba-step__n">{s.state === 'done' ? <Icon name="check" size={13} strokeWidth={2.6} /> : i + 1}</span>{s.label}</>;
        return (
          <li key={s.key} style={{ display: 'contents' }}>
            {i > 0 && <span className="ba-step__sep" aria-hidden />}
            {renderLink && s.href ? renderLink(s, inner, cls) : <span className={cls} aria-current={s.state === 'current' ? 'step' : undefined}>{inner}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Filrad ---------- */
export function FileRow({ source, title, sub, status, onHelp, action }: { source?: string; title: string; sub?: ReactNode; status: 'ok' | 'missing' | 'error' | 'auto'; onHelp?: () => void; action?: ReactNode }) {
  return (
    <div className={cx('ba-file', status === 'missing' && 'ba-file--missing', status === 'error' && 'ba-file--error')}>
      <span className="ba-file__icon" aria-hidden><Icon name={status === 'ok' || status === 'auto' ? 'check' : status === 'error' ? 'alert' : 'upload'} size={15} /></span>
      <div className="ba-grow" style={{ minWidth: 0 }}>
        {source && <div className="ba-file__src">{source}</div>}
        <div className="ba-file__title">{title}</div>
        {sub && <div className="ba-file__sub">{sub}</div>}
        {onHelp && status !== 'ok' && <button type="button" className="ba-file__help" onClick={onHelp}>Var hittar jag filen?</button>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Dra in filer (en yta för alla filer, även från mobilen) ---------- */
export function DropZone({ title = 'Dra in månadens filer här', text, onFiles, accept, multiple = true, button = 'Välj filer', compact }: { title?: string; text?: ReactNode; onFiles: (f: File[]) => void; accept?: string; multiple?: boolean; button?: string; compact?: boolean }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); const f = [...(e.dataTransfer?.files || [])]; if (f.length) onFiles(f); };
  return (
    <div className={cx('ba-drop', over && 'ba-drop--over')} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
      <span className="ba-drop__icon"><Icon name="upload" size={18} /></span>
      <div className="ba-grow"><h3>{title}</h3>{text && !compact && <p>{text}</p>}</div>
      <input ref={input} type="file" hidden multiple={multiple} accept={accept} onChange={e => { const f = [...(e.target.files || [])]; e.target.value = ''; if (f.length) onFiles(f); }} />
      <Button onClick={() => input.current?.click()}>{button}</Button>
    </div>
  );
}

/* ---------- Kom igång-lista ---------- */
export interface ChecklistItem { key: string; title: string; sub?: string; done: boolean; href?: string; onClick?: () => void }
export function Checklist({ items, renderLink }: { items: ChecklistItem[]; renderLink?: (it: ChecklistItem, children: ReactNode) => ReactNode }) {
  return (
    <ul className="ba-check-list">
      {items.map(it => {
        const inner = <><span className="dot" aria-hidden>{it.done && <Icon name="check" size={12} strokeWidth={3} />}</span><span className="ba-grow"><span className="t">{it.title}</span>{it.sub && <span className="s" style={{ display: 'block' }}>{it.sub}</span>}</span>{!it.done && <Icon name="right" size={16} className="muted" />}</>;
        return <li key={it.key} className={it.done ? 'done' : ''}>{!it.done && renderLink && (it.href || it.onClick) ? renderLink(it, inner) : <span style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>{inner}<span className="sr-only">{it.done ? 'klar' : 'inte klar'}</span></span>}</li>;
      })}
    </ul>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, wide, labelledBy, dark }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; labelledBy?: string; dark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => (ref.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || ref.current)?.focus(), 20);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key); document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); document.removeEventListener('keydown', key); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="ba-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={cx('ba-modal', wide && 'ba-modal--wide')} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} style={dark ? { background: 'transparent', boxShadow: 'none' } : undefined}>
        {title && <div className="ba-modal__head"><h2 id={labelledBy} style={{ fontSize: 18 }}>{title}</h2></div>}
        {title ? <div className="ba-modal__body">{children}</div> : children}
        {footer && <div className="ba-modal__foot">{footer}</div>}
      </div>
    </div>, document.body);
}

/* ---------- Toast ---------- */
type ToastT = { id: number; text: string; tone?: 'bad'; action?: { label: string; onClick: () => void } };
const ToastCtx = createContext<(t: string, o?: { tone?: 'bad'; action?: ToastT['action']; ms?: number }) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastT[]>([]);
  const push = useCallback((text: string, o: { tone?: 'bad'; action?: ToastT['action']; ms?: number } = {}) => {
    const id = Date.now() + Math.random();
    setList(l => [...l.slice(-2), { id, text, tone: o.tone, action: o.action }]);
    setTimeout(() => setList(l => l.filter(x => x.id !== id)), o.ms || (o.tone ? 7000 : 3800));
  }, []);
  return <ToastCtx.Provider value={push}>{children}<div className="ba-toasts" role="status" aria-live="polite">{list.map(t => <div key={t.id} className={cx('ba-toast', t.tone && 'ba-toast--bad')}><span>{t.text}</span>{t.action && <button type="button" onClick={t.action.onClick}>{t.action.label}</button>}</div>)}</div></ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Pennan: signera genom att rita (eller skriva namnet). Som avPad i prototypen. ---------- */
export interface SignatureHandle { isDirty: () => boolean; png: () => string; clear: () => void }
export function SignaturePad({ label, onChange, handleRef }: { label: string; onChange?: (dirty: boolean) => void; handleRef?: (h: SignatureHandle) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const st = useRef({ draw: false, last: null as null | [number, number], dirty: false });
  const [typed, setTyped] = useState('');
  const ctx = () => { const c = cv.current!.getContext('2d')!; c.lineWidth = 4.5; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#0E1E35'; return c; };
  const setDirty = (d: boolean) => { st.current.dirty = d; onChange?.(d); };
  const clear = () => { ctx().clearRect(0, 0, 900, 280); setDirty(false); setTyped(''); };
  useEffect(() => {
    handleRef?.({
      isDirty: () => st.current.dirty, clear,
      png: () => { const o = document.createElement('canvas'); o.width = 450; o.height = 140; o.getContext('2d')!.drawImage(cv.current!, 0, 0, 450, 140); return o.toDataURL('image/png'); }
    });
  });
  const pos = (e: React.PointerEvent): [number, number] => { const r = cv.current!.getBoundingClientRect(); return [(e.clientX - r.left) * 900 / r.width, (e.clientY - r.top) * 280 / r.height]; };
  const type = (t: string) => {
    setTyped(t); const c = ctx(); c.clearRect(0, 0, 900, 280); const s = t.trim(); setDirty(!!s); if (!s) return;
    let fs = 120; c.fillStyle = '#0E1E35';
    do { c.font = 'italic ' + fs + 'px "Instrument Serif", "Segoe Script", "Brush Script MT", cursive'; fs -= 4; } while (c.measureText(s).width > 840 && fs > 30);
    c.textBaseline = 'alphabetic'; c.fillText(s, 30, 210);
  };
  return (
    <div className="ba-sig">
      <div className="ba-row" style={{ marginBottom: 8 }}><b className="small" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="pencil" size={14} />{label}</b><span className="ba-grow" /><Button size="sm" variant="link" onClick={clear}>Rensa</Button></div>
      <canvas ref={cv} width={900} height={280} aria-label={label + '. Rita med finger, penna eller mus.'} role="img"
        onPointerDown={e => { st.current.draw = true; st.current.last = pos(e); (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId); e.preventDefault(); }}
        onPointerMove={e => { if (!st.current.draw) return; const p = pos(e); const c = ctx(); c.beginPath(); c.moveTo(...st.current.last!); c.lineTo(...p); c.stroke(); st.current.last = p; if (!st.current.dirty) setDirty(true); e.preventDefault(); }}
        onPointerUp={() => { st.current.draw = false; }} onPointerCancel={() => { st.current.draw = false; }} onPointerLeave={() => { st.current.draw = false; }} />
      <div className="ba-sig__line">Rita med finger, penna eller mus ovanför linjen, eller skriv namnet nedan</div>
      <input className="ba-input" style={{ marginTop: 8 }} placeholder="Eller skriv ditt namn här" value={typed} onChange={e => type(e.target.value)} autoComplete="off" aria-label="Skriv ditt namn som underskrift" />
    </div>
  );
}

/* ---------- Banderoll ---------- */
export function Banner({ children, tone, action }: { children: ReactNode; tone?: 'info'; action?: ReactNode }) {
  return <div className={cx('ba-banner', tone && 'ba-banner--' + tone)} role="note"><Icon name="info" size={16} /><span className="ba-grow">{children}</span>{action}</div>;
}

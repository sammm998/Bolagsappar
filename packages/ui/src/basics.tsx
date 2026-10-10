import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId } from 'react';
import { Icon } from './icons';

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');
export { cx };

type BtnVariant = 'primary' | 'dark' | 'soft' | 'link' | 'secondary' | 'danger';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: string; iconRight?: string; block?: boolean; loading?: boolean }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', icon, iconRight, block, loading, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} type="button" className={cx('ba-btn', variant !== 'secondary' && 'ba-btn--' + variant, size !== 'md' && 'ba-btn--' + size, block && 'ba-btn--block', !children && 'ba-btn--icon', className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {icon && <Icon name={loading ? 'refresh' : icon} size={size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={14} />}
    </button>
  );
});
export const btnClass = (variant: BtnVariant = 'secondary', size: 'sm' | 'md' | 'lg' = 'md', extra?: string) => cx('ba-btn', variant !== 'secondary' && 'ba-btn--' + variant, size !== 'md' && 'ba-btn--' + size, extra);

export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return <div className="ba-field"><label htmlFor={htmlFor}>{label}</label>{children}{error ? <span className="ba-err" role="alert">{error}</span> : hint ? <span className="ba-hint">{hint}</span> : null}</div>;
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(function Input({ className, mono, ...rest }, ref) {
  return <input ref={ref} className={cx('ba-input', mono && 'num', className)} {...rest} />;
});
export function TextField({ label, hint, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode; error?: ReactNode; mono?: boolean }) {
  const id = useId();
  return <Field label={label} hint={hint} error={error} htmlFor={id}><Input id={id} aria-invalid={!!error || undefined} {...rest} /></Field>;
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={cx('ba-select', className)} {...rest}>{children}</select>; }
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={cx('ba-textarea', className)} {...rest} />; }
export function Checkbox({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) { return <label className="ba-check"><input type="checkbox" {...rest} /> <span>{label}</span></label>; }

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'draft' | 'navy' | 'line';
export function Pill({ tone = 'draft', dot = true, children, title }: { tone?: Tone; dot?: boolean; children: ReactNode; title?: string }) {
  return <span className={cx('ba-pill', tone !== 'draft' && 'ba-pill--' + tone)} title={title}>{dot && <i />}{children}</span>;
}
export function Tag({ children, soft }: { children: ReactNode; soft?: boolean }) { return <span className={cx('ba-tag', soft && 'ba-tag--soft')}>{children}</span>; }

export function Card({ title, actions, children, pad = true, tone, className, id, headExtra }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; pad?: boolean; tone?: 'subtle' | 'navy' | 'green'; className?: string; id?: string; headExtra?: ReactNode }) {
  return (
    <section className={cx('ba-card', tone && 'ba-card--' + tone, className)} id={id}>
      {title && <div className="ba-card__head"><h2>{title}</h2>{headExtra}<span className="ba-grow" />{actions}</div>}
      <div className={pad ? 'ba-card__body' : undefined}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub, subTone, bars, mono = false }: { label: ReactNode; value: ReactNode; sub?: ReactNode; subTone?: 'warn' | 'ok'; bars?: number[]; mono?: boolean }) {
  const max = bars ? Math.max(1, ...bars.map(Math.abs)) : 1;
  return (
    <div className="ba-kpi">
      <span className="ba-kpi__label">{label}</span>
      <span className={cx('ba-kpi__value', mono && 'num')}>{value}</span>
      {sub && <span className={cx('ba-kpi__sub', subTone && 'ba-kpi__sub--' + subTone)}>{sub}</span>}
      {bars && <div className="ba-bars" aria-hidden>{bars.map((b, i) => <span key={i} className={i === bars.length - 1 ? 'on' : ''} style={{ height: Math.max(12, Math.abs(b) / max * 100) + '%' }} />)}</div>}
    </div>
  );
}
export function Bars({ values, labels, tall }: { values: number[]; labels?: string[]; tall?: boolean }) {
  const max = Math.max(1, ...values.map(Math.abs));
  return (<div><div className={cx('ba-bars', tall && 'ba-bars--tall')} role="img" aria-label={labels ? labels.map((l, i) => l + ' ' + Math.round(values[i])).join(', ') : undefined}>{values.map((v, i) => <span key={i} className={i === values.length - 1 ? 'on' : ''} style={{ height: Math.max(8, Math.abs(v) / max * 100) + '%' }} />)}</div>{labels && <div className="ba-bars-lab">{labels.map(l => <span key={l}>{l}</span>)}</div>}</div>);
}

export function EmptyState({ icon = 'upload', title, children, action }: { icon?: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return <div className="ba-empty"><div className="ba-empty__icon"><Icon name={icon} size={20} /></div><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}

export function Deviation({ who, title, text, tone = 'bad', actions }: { who?: ReactNode; title: ReactNode; text?: ReactNode; tone?: 'bad' | 'warn' | 'info' | 'done'; actions?: { label: string; onClick: () => void }[] }) {
  return (
    <div className={cx('ba-dev', tone !== 'bad' && 'ba-dev--' + tone)}>
      {who && <div className="ba-dev__who">{who}</div>}
      <div className="ba-dev__title">{title}</div>
      {text && <div className="ba-dev__text">{text}</div>}
      {actions && <div className="ba-dev__acts">{actions.map(a => <button key={a.label} type="button" onClick={a.onClick}>{a.label}</button>)}</div>}
    </div>
  );
}

export function AppIcon({ icon, tone = 'blue', size = 'md' }: { icon: string; tone?: string; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={cx('ba-appicon', 'ba-appicon--' + tone, size !== 'md' && 'ba-appicon--' + size)} aria-hidden><Icon name={icon} size={size === 'sm' ? 13 : size === 'lg' ? 20 : 17} /></span>;
}
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="ba-switch" disabled={disabled} onClick={() => onChange(!checked)} />;
}
export function ToggleRow({ icon, tone, title, sub, checked, onChange, disabled }: { icon: string; tone?: string; title: string; sub?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <div className="ba-toggle-row"><AppIcon icon={icon} tone={tone} /><div className="ba-grow"><b>{title}</b>{sub && <div className="small muted">{sub}</div>}</div><Switch checked={checked} onChange={onChange} label={title} disabled={disabled} /></div>;
}
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return <div className="ba-seg" role="group" aria-label={label}>{options.map(o => <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}</div>;
}
export function Progress({ value, max = 1, onNavy, label }: { value: number; max?: number; onNavy?: boolean; label?: string }) {
  const p = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return <div className={cx('ba-progress', onNavy && 'ba-progress--on-navy')} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}><span style={{ width: p + '%' }} /></div>;
}
export function Avatar({ text, accent, color, size = 'md', round }: { text: string; accent?: string; color?: string; size?: 'sm' | 'md' | 'lg'; round?: boolean }) {
  return <span className={cx('ba-av', round && 'ba-av--round', size !== 'md' && 'ba-av--' + size)} style={accent ? { background: accent, color: color || '#fff', borderColor: 'transparent' } : undefined} aria-hidden>{text}</span>;
}
export function Logo({ dark = false, size = 20, text = true }: { dark?: boolean; size?: number; text?: boolean }) {
  const c = dark ? '#FFFFFF' : '#0E1E35', g = dark ? '#A9C9B6' : '#1F4D3A', s = size / 2 - 1;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.4, fontWeight: 700, fontSize: size * 0.95, letterSpacing: '-.02em', color: c }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden><rect x="0" y="0" width={s} height={s} rx={s * 0.32} fill={c} /><rect x={s + 2} y="0" width={s} height={s} rx={s * 0.32} fill={c} /><rect x="0" y={s + 2} width={s} height={s} rx={s * 0.32} fill={c} /><rect x={s + 2} y={s + 2} width={s} height={s} rx={s * 0.32} fill={g} /></svg>
      {text && <span>bolagsappar</span>}
    </span>
  );
}

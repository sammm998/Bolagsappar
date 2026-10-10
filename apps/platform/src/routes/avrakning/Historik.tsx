// Historik: alla publicerade månader finns kvar. En rättelse syns som en ny version.
import { Link } from '@tanstack/react-router';
import { Card, EmptyState, Pill } from '@bolagsappar/ui';
import { krs, manadAr } from '@bolagsappar/core/format';
import { useAccount } from '../../lib/session';
import { usePeriods, useSharesFrom } from '../../lib/q';
import { useMonths, M } from '../../lib/avr';
import { usePage } from '../../shell/Help';
import { Loading } from '../../shell/Shell';

export function Historik() {
  const a = useAccount();
  const per = usePeriods(a.tenant.id, M);
  const { months } = useMonths(a.tenant.id);
  const sh = useSharesFrom(a.tenant.id, M);
  usePage({ crumbs: ['Avräkning', 'Historik'], module: 'avrakning', variant: 'main', view: 'historik' }, []);
  if (per.isLoading) return <Loading />;
  const L = per.data || [];
  if (!L.length) return <EmptyState icon="receipt" title="Ingen historik än">När du har publicerat den första månaden syns den här.</EmptyState>;
  return (
    <>
      <div className="pf-head"><div className="ba-grow"><div className="pf-eyebrow">Avräkning</div><h1 className="pf-h1">Historik</h1></div><Link className="ba-btn" to="/$tenant/avrakning/installningar" params={{ tenant: a.tenant.slug }}>Inställningar</Link></div>
      <div className="ba-table-wrap">
        <table className="ba-table">
          <thead><tr><th>Månad</th><th>Status</th><th className="n">Version</th><th>Publicerad</th><th className="n">Till åkare</th><th className="n">Åkare</th><th className="n">Öppnad</th><th /></tr></thead>
          <tbody>{L.map(p => {
            const s = months[p.period]?.summary; const ut = s ? -s.bolag.filter((b: any) => b.att < 0).reduce((x: number, b: any) => x + b.att, 0) : null;
            const S = (sh.data || []).filter(x => x.period === p.period && x.version === p.version);
            return (
              <tr key={p.period}>
                <td className="b">{manadAr(p.period)}</td>
                <td>{p.status === 'publicerad' ? <Pill tone="ok">Publicerad</Pill> : p.status === 'godkand' ? <Pill tone="info">Godkänd</Pill> : <Pill tone="warn">Pågår</Pill>}</td>
                <td className="n">{p.version}</td><td className="small">{p.published_at ? String(p.published_at).slice(0, 10) : ''}</td>
                <td className="n">{ut == null ? '' : krs(ut, false)}</td><td className="n">{S.length || ''}</td><td className="n">{S.length ? `${S.filter(x => x.opened_at).length} av ${S.length}` : ''}</td>
                <td><Link className="ba-btn ba-btn--sm" to="/$tenant/avrakning/$period/kontroll" params={{ tenant: a.tenant.slug, period: p.period }}>Öppna</Link></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <Card tone="subtle" className="pf-section"><p className="small" style={{ margin: 0 }}>En publicerad avräkning kan inte ändras. Rättelser görs under Godkänn och publiceras som en ny version med orsak. Åkarna ser båda versionerna.</p></Card>
    </>
  );
}

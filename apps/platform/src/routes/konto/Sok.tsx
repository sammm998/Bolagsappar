// Sök i kontot: åkare, förare, månader och ärenden.
import { Link, useSearch } from '@tanstack/react-router';
import { Card, EmptyState } from '@bolagsappar/ui';
import { manadAr } from '@bolagsappar/core/format';
import { useAccount } from '../../lib/session';
import { useDoc, useDocs, useNetwork, usePeriods, useSharesTo } from '../../lib/q';
import { usePage } from '../../shell/Help';

export function Sok() {
  const a = useAccount(); const { q = '' } = useSearch({ strict: false }) as { q?: string };
  usePage({ crumbs: ['Sök'] }, []);
  const s = q.toLowerCase().trim();
  const main = a.tenant.type === 'main' && !a.isDriver;
  const net = useNetwork(main ? a.tenant.id : undefined);
  const fl = useDoc<any>(main ? a.tenant.id : undefined, 'forarlista', 'lista');
  const per = usePeriods(main ? a.tenant.id : undefined, 'avrakning');
  const sh = useSharesTo(a.tenant.type === 'sub' ? a.tenant.id : undefined, 'avrakning');
  const ar = useDocs<any>(a.tenant.type === 'direct' ? a.tenant.id : undefined, 'verkstad', 'arenden');
  const hit = (...x: any[]) => x.join(' ').toLowerCase().includes(s);
  const res: { to: string; title: string; sub: string }[] = [];
  for (const x of net.data || []) if (hit(x.name, x.org_nr)) res.push({ to: 'akare', title: x.name, sub: 'Åkare' });
  for (const f of (fl.data?.forare || []).slice(0, 2000)) if (hit(f.namn, f.nr, f.senasteBil)) res.push({ to: 'forarlista', title: f.namn, sub: `Förare, ${f.akeri}` });
  for (const p of per.data || []) if (hit(manadAr(p.period), p.period)) res.push({ to: `avrakning/${p.period}/kontroll`, title: 'Avräkning ' + manadAr(p.period), sub: p.status });
  for (const x of sh.data || []) if (hit(manadAr(x.period), x.period)) res.push({ to: `min-avrakning/${x.period}`, title: 'Min avräkning ' + manadAr(x.period), sub: x.payload.meddelande });
  for (const d of ar.data || []) if (hit(d.id, d.data.reg, d.data.skadenr)) res.push({ to: `verkstad/arende/${d.id}`, title: `${d.id} ${d.data.reg}`, sub: 'Ärende' });
  return (
    <>
      <div className="pf-head"><div className="ba-grow"><h1 className="pf-h1">Sök</h1><p className="pf-lead">{res.length} träffar på "{q}"</p></div></div>
      {!res.length ? <EmptyState icon="search" title="Inga träffar">Prova ett annat ord, till exempel ett åkeri, en förare eller en månad.</EmptyState> :
        <Card pad={false}><ul className="pf-list-plain">{res.slice(0, 60).map((r, i) => <li key={i} style={{ borderTop: i ? '1px solid var(--line)' : 0 }}><Link to={'/' + a.tenant.slug + '/' + r.to} style={{ display: 'block', padding: '12px 18px', textDecoration: 'none' }}><b>{r.title}</b><div className="small muted">{r.sub}</div></Link></li>)}</ul></Card>}
    </>
  );
}

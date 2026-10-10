import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, EmptyState } from '@bolagsappar/ui';
import { useAccount } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useNotifications } from '../../lib/q';
import { usePage } from '../../shell/Help';

export function Notiser() {
  const a = useAccount(); const b = useBackend(); const qc = useQueryClient();
  const q = useNotifications(a.tenant.id);
  usePage({ crumbs: ['Notiser'] }, []);
  const L = q.data || [];
  const read = async (id: string) => { await b.markRead(id); qc.invalidateQueries({ queryKey: ['notifications'] }); };
  return (
    <>
      <div className="pf-head"><div className="ba-grow"><h1 className="pf-h1">Notiser</h1></div>{L.some(n => !n.read_at) && <Button onClick={async () => { for (const n of L.filter(n => !n.read_at)) await b.markRead(n.id); qc.invalidateQueries({ queryKey: ['notifications'] }); }}>Markera alla som lästa</Button>}</div>
      {!L.length ? <EmptyState icon="bell" title="Inga notiser">Här hamnar till exempel nya avräkningar och lönespecar.</EmptyState> : (
        <div className="ba-stack">{L.map(n => (
          <Card key={n.id} tone={n.read_at ? undefined : 'subtle'}>
            <div className="ba-row" style={{ flexWrap: 'nowrap' }}>
              <div className="ba-grow"><b>{n.title}</b><div className="small">{n.body}</div><div className="small muted">{String(n.created_at).slice(0, 16).replace('T', ' ')}</div></div>
              {n.link && <Link className="ba-btn ba-btn--sm" to={'/' + a.tenant.slug + '/' + n.link} onClick={() => read(n.id)}>Öppna</Link>}
              {!n.read_at && <Button size="sm" variant="link" onClick={() => read(n.id)}>Markera som läst</Button>}
            </div>
          </Card>
        ))}</div>
      )}
    </>
  );
}

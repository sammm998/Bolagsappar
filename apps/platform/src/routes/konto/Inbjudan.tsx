// En inbjudan kopplas till personen som loggar in med länken.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Card, Logo } from '@bolagsappar/ui';
import { useBackend } from '../../lib/backend';
import { useSession } from '../../lib/session';

export function Inbjudan() {
  const { token } = useParams({ strict: false }) as { token: string };
  const b = useBackend(); const s = useSession(); const nav = useNavigate();
  const [err, setErr] = useState('');
  useEffect(() => {
    if (s.loading || !s.user) return;
    b.acceptInvite(token).then(async () => { await s.refresh(); nav({ to: '/valj-bolag' }); }).catch((e: any) => setErr(e.message));
  }, [s.loading, s.user, token]);
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
      <Card><div style={{ maxWidth: 420 }} className="ba-stack"><Logo /><h1 className="pf-h1">Inbjudan</h1>
        {!s.user ? <><p className="pf-lead">Logga in med e-postadressen som inbjudan skickades till, så kopplas du ihop med ditt åkeri.</p><Link className="ba-btn ba-btn--primary" to="/logga-in">Logga in</Link></> : err ? <p className="pf-lead">{err}</p> : <p className="pf-lead">Kopplar ihop…</p>}
      </div></Card>
    </div>
  );
}

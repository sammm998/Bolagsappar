// Hjälp och guider: alla guider för kontots appar, välkomstguiden kan alltid öppnas igen, kontakta support.
import { useState } from 'react';
import { AppIcon, Button, Card, Textarea, useToast } from '@bolagsappar/ui';
import { guideFor } from '@bolagsappar/guides';
import { useAccount } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useLicenses } from '../../lib/q';
import { myApps } from '../../lib/apps';
import { useHelpCtx, usePage } from '../../shell/Help';

export function Hjalp() {
  const a = useAccount(); const b = useBackend(); const toast = useToast(); const help = useHelpCtx();
  const lic = useLicenses(a.tenant.id);
  const apps = myApps(a.tenant.type, lic.data || []);
  const [msg, setMsg] = useState('');
  usePage({ crumbs: ['Hjälp och guider'] }, []);
  return (
    <>
      <div className="pf-head"><div className="ba-grow"><h1 className="pf-h1">Hjälp och guider</h1><p className="pf-lead">Varje app visar själv hur den fungerar. Knappen "Så funkar det" uppe till höger visar hjälp för just den vy du står i.</p></div></div>
      <div className="ba-grid ba-grid--2">
        {apps.map(x => {
          const g = guideFor(x.key, x.variant, { central: a.central.replace(/ AB$/, '') }); if (!g) return null;
          return (
            <Card key={x.key}>
              <div className="ba-row" style={{ marginBottom: 8 }}><AppIcon icon={x.icon} tone={x.tone} /><b>{x.name}</b><span className="ba-grow" /><Button size="sm" variant="soft" onClick={() => help.openWelcome(x.key, x.variant)}>Visa välkomstguiden</Button></div>
              <ol className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>{g.welcome.map((w: any) => <li key={w.title}>{w.body}</li>)}</ol>
              {Object.keys(g.help || {}).length > 0 && <dl className="small" style={{ margin: '10px 0 0' }}>{Object.entries(g.help).map(([k, h]: any) => <div key={k} style={{ marginTop: 4 }}><dt style={{ fontWeight: 600, display: 'inline' }}>{h.title}. </dt><dd style={{ display: 'inline', margin: 0 }} className="muted">{h.body}</dd></div>)}</dl>}
            </Card>
          );
        })}
        <Card title="Kontakta support">
          <p className="small muted" style={{ marginTop: 0 }}>Support på svenska. Vi svarar samma arbetsdag.</p>
          <Textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Vad behöver du hjälp med?" aria-label="Meddelande till support" />
          <div style={{ marginTop: 10 }}><Button variant="dark" onClick={async () => { if (!msg.trim()) return; await b.createTicket(a.tenant.id, msg.trim().slice(0, 200)); setMsg(''); toast('Tack. Vi hör av oss.'); }}>Skicka</Button></div>
        </Card>
      </div>
    </>
  );
}

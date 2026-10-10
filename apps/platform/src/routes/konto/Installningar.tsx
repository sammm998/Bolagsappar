// Inställningar för kontot: bolaget (white label), användare och roller, supportinloggning och granskningslogg.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, EmptyState, Pill, Select, TextField, useToast, Banner } from '@bolagsappar/ui';
import { initialer } from '@bolagsappar/core/format';
import { useAccount, useSession, ROLLNAMN } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useAudit, useMembers, useSupport } from '../../lib/q';
import { usePage } from '../../shell/Help';

const TABS = [['bolag', 'Bolaget'], ['anvandare', 'Användare'], ['support', 'Support'], ['logg', 'Granskningslogg']] as const;

export function Installningar() {
  const a = useAccount();
  const [tab, setTab] = useState<string>('bolag');
  usePage({ crumbs: ['Inställningar'] }, []);
  const tabs = TABS.filter(([k]) => a.role === 'agare' || a.role === 'admin' || k === 'bolag');
  return (
    <>
      <div className="pf-head"><div className="ba-grow"><h1 className="pf-h1">Inställningar</h1><p className="pf-lead">{a.tenant.name}</p></div></div>
      <nav className="ba-tabs" role="tablist" style={{ marginBottom: 18 }}>{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</nav>
      {tab === 'bolag' && <Bolaget />}
      {tab === 'anvandare' && <Anvandare />}
      {tab === 'support' && <Support />}
      {tab === 'logg' && <Logg />}
    </>
  );
}

function Bolaget() {
  const a = useAccount(); const b = useBackend(); const toast = useToast(); const s = useSession(); const qc = useQueryClient();
  const t = a.tenant; const kan = a.role === 'agare' || a.role === 'admin' || (a.tenant.type === 'main' && a.canWrite);
  const [f, setF] = useState({ name: t.name, org_nr: t.org_nr || '', initialer: t.brand?.initialer || initialer(t.name), accent: t.brand?.accent || '#0E1E35', text: t.brand?.text || '#FFFFFF', ort: t.settings?.ort || '', kontakt: t.settings?.kontakt || '', centralNamn: t.settings?.centralNamn || '', utbDag: t.settings?.utbDag || 5 });
  const save = async () => {
    try {
      await b.updateTenant(t.id, { name: f.name.trim(), org_nr: f.org_nr.trim() || null, brand: { ...t.brand, initialer: f.initialer.trim().slice(0, 3).toUpperCase(), accent: f.accent, text: f.text }, settings: { ...t.settings, ort: f.ort, kontakt: f.kontakt, ...(t.type === 'main' ? { centralNamn: f.centralNamn, utbDag: +f.utbDag || 5 } : {}) } });
      if (t.type === 'main') await b.setGuideStep(t.id, 'avrakning', 'bolag', true);
      await s.refresh(); qc.invalidateQueries(); toast('Sparat.');
    } catch (e: any) { toast(e.message, { tone: 'bad' }); }
  };
  return (
    <div className="pf-sidebar-layout pf-sidebar-layout--right">
      <Card title="Bolaget">
        <div className="ba-grid ba-grid--2">
          <TextField label="Namn" value={f.name} disabled={!kan} onChange={e => setF({ ...f, name: e.target.value })} />
          <TextField label="Organisationsnummer" mono value={f.org_nr} disabled={!kan} onChange={e => setF({ ...f, org_nr: e.target.value })} />
          <TextField label="Ort" value={f.ort} disabled={!kan} onChange={e => setF({ ...f, ort: e.target.value })} />
          <TextField label="Kontakt (telefon)" value={f.kontakt} disabled={!kan} onChange={e => setF({ ...f, kontakt: e.target.value })} />
          {t.type === 'main' && <TextField label="Namn i avtal och PDF:er" value={f.centralNamn} disabled={!kan} onChange={e => setF({ ...f, centralNamn: e.target.value })} hint="Till exempel Taxi Malmö AB" />}
          {t.type === 'main' && <TextField label="Utbetalningsdag till åkare" type="number" min={1} max={28} value={f.utbDag} disabled={!kan} onChange={e => setF({ ...f, utbDag: e.target.value })} hint="Dag i månaden efter avräkningsmånaden" />}
        </div>
        {kan && <div style={{ marginTop: 16 }}><Button variant="dark" onClick={save}>Spara</Button></div>}
      </Card>
      <Card title="Logga och färg">
        <div className="ba-row" style={{ marginBottom: 14 }}><Avatar size="lg" text={f.initialer} accent={f.accent} color={f.text} /><span className="small muted">Syns i kontoväljaren, i appen och på PDF:er.</span></div>
        <div className="ba-stack">
          <TextField label="Initialer" value={f.initialer} disabled={!kan} maxLength={3} onChange={e => setF({ ...f, initialer: e.target.value })} />
          <label className="ba-field"><span className="ba-label">Färg</span><input type="color" value={f.accent} disabled={!kan} onChange={e => setF({ ...f, accent: e.target.value })} style={{ width: 64, height: 40, border: '1px solid var(--line)', borderRadius: 8 }} aria-label="Färg" /></label>
        </div>
      </Card>
    </div>
  );
}

function Anvandare() {
  const a = useAccount(); const b = useBackend(); const toast = useToast(); const qc = useQueryClient();
  const m = useMembers(a.tenant.id);
  const [f, setF] = useState({ email: '', name: '', role: 'ekonomi', forare_id: '' });
  const add = async () => {
    if (!/^\S+@\S+\.\S+$/.test(f.email)) { toast('Skriv en e-postadress.', { tone: 'bad' }); return; }
    try { await b.addMember(a.tenant.id, f); qc.invalidateQueries({ queryKey: ['memberships'] }); toast(`${f.email} är tillagd och får en inloggningslänk.`); setF({ email: '', name: '', role: 'ekonomi', forare_id: '' }); }
    catch (e: any) { toast(e.message, { tone: 'bad' }); }
  };
  const roller = a.tenant.type === 'sub' ? ['agare', 'admin', 'ekonomi', 'forare', 'las'] : ['agare', 'admin', 'ekonomi', 'las'];
  return (
    <div className="pf-sidebar-layout pf-sidebar-layout--right">
      <div className="ba-table-wrap"><table className="ba-table"><thead><tr><th>Användare</th><th>Roll</th><th>Senast inloggad</th></tr></thead>
        <tbody>{(m.data || []).map(x => <tr key={x.user_id}><td><div className="ba-who"><Avatar round size="sm" text={initialer(x.user?.name || x.user?.email)} /><div><b>{x.user?.name || x.user?.email}</b><small>{x.user?.email}</small></div></div></td><td>{ROLLNAMN[x.role]}{x.forare_id ? <span className="small muted"> · nr {x.forare_id}</span> : null}</td><td className="small">{x.user?.last_login_at ? String(x.user.last_login_at).slice(0, 10) : 'Aldrig'}</td></tr>)}</tbody></table></div>
      <Card title="Lägg till användare">
        <div className="ba-stack">
          <TextField label="E-post" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
          <TextField label="Namn" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <label className="ba-field"><span className="ba-label">Roll</span><Select value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>{roller.map(r => <option key={r} value={r}>{ROLLNAMN[r]}</option>)}</Select></label>
          {f.role === 'forare' && <TextField label="Förarnummer i Megtax" mono value={f.forare_id} onChange={e => setF({ ...f, forare_id: e.target.value })} />}
          <p className="small muted" style={{ margin: 0 }}>Ägare: allt, även avtal och betalning. Admin: användare, appar och inställningar. Ekonomi: ladda upp, räkna, godkänna och publicera. Förare: bara egna lönespecar och pass. Läs: se allt, ändra inget.</p>
          <Button variant="dark" onClick={add}>Lägg till</Button>
        </div>
      </Card>
    </div>
  );
}

function Support() {
  const a = useAccount(); const b = useBackend(); const toast = useToast(); const qc = useQueryClient();
  const s = useSupport(a.tenant.id);
  const aktiv = (s.data || []).find(x => new Date(x.granted_until) > new Date());
  const [h, setH] = useState('24');
  return (
    <Card title="Supportinloggning">
      <p className="small" style={{ marginTop: 0 }}>Bolagsappar kan bara se ert konto om ni godkänner det. Allt support gör loggas synligt i granskningsloggen.</p>
      {aktiv ? <Banner tone="info" action={<Button size="sm" onClick={async () => { await b.revokeSupport(a.tenant.id); qc.invalidateQueries({ queryKey: ['support_access'] }); toast('Supportinloggningen är återkallad.'); }}>Återkalla</Button>}>Support har tillgång till {String(aktiv.granted_until).slice(0, 16).replace('T', ' ')}.</Banner>
        : <div className="ba-row"><Select value={h} onChange={e => setH(e.target.value)} style={{ width: 160 }} aria-label="Hur länge"><option value="2">2 timmar</option><option value="24">24 timmar</option><option value="72">3 dagar</option></Select><Button variant="dark" onClick={async () => { await b.grantSupport(a.tenant.id, +h, 'Godkänt i inställningarna'); qc.invalidateQueries({ queryKey: ['support_access'] }); toast('Support har fått tillgång.'); }}>Ge support tillgång</Button></div>}
    </Card>
  );
}

function Logg() {
  const a = useAccount(); const q = useAudit(a.tenant.id);
  if (!q.data?.length) return <EmptyState icon="file" title="Inget loggat än" />;
  return (
    <div className="ba-table-wrap"><table className="ba-table"><thead><tr><th>Tid</th><th>Händelse</th><th>Vad</th><th>Via support</th></tr></thead>
      <tbody>{q.data.slice(0, 200).map(x => <tr key={x.id}><td className="num small">{String(x.at).slice(0, 16).replace('T', ' ')}</td><td>{x.action}</td><td className="small">{x.target}</td><td>{x.via_support ? <Pill tone="warn">Ja</Pill> : ''}</td></tr>)}</tbody></table></div>
  );
}

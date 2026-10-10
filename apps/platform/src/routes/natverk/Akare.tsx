// Åkare (sidan 28). Status för månadens avräkning per åkare och tydligt vad centralen inte kan se.
import { useMemo, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Checkbox, Icon, Modal, Pill, Segmented, TextField, useToast } from '@bolagsappar/ui';
import { writeXlsx } from '@bolagsappar/core/filetypes';
import { initialer, manad, relativDag } from '@bolagsappar/core/format';
import { moduleByKey } from '@bolagsappar/modules';
import { useAccount } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useNetwork, useOffers } from '../../lib/q';
import { useLastPublished, useSettings } from '../../lib/avr';
import { download } from '../../lib/files';
import { usePage } from '../../shell/Help';

const APPNAMN: Record<string, string> = { avrakning: 'Min avräkning', kassan: 'Åkarkassan', forarlista: 'Mina förare', skadeflode: 'Skadeflöde', korjournal: 'Körjournal' };

export function Akare() {
  const a = useAccount(); const t = a.tenant.id;
  const search = useSearch({ strict: false }) as any;
  const last = useLastPublished(t);
  const net = useNetwork(t, 'avrakning', last?.period || null);
  const { S } = useSettings(t);
  const [filter, setFilter] = useState<'alla' | 'ej' | 'inbjudna'>('alla');
  const [q, setQ] = useState('');
  const [invite, setInvite] = useState(!!search.bjud);
  usePage({ crumbs: ['Åkare'] }, []);
  const bilar = useMemo(() => { const m = new Map<string, any[]>(); for (const b of S?.bilar || []) { const k = b.avr || b.bolag; if (!m.has(k)) m.set(k, []); m.get(k)!.push(b); } return m; }, [S]);
  const L = net.data || [];
  const ej = L.filter(x => !x.invited && !x.opened_at), inb = L.filter(x => x.invited);
  const shown = (filter === 'ej' ? ej : filter === 'inbjudna' ? inb : L).filter(x => !q || [x.name, x.org_nr, ...(bilar.get(x.name) || []).map((b: any) => b.reg + ' ' + b.bil)].join(' ').toLowerCase().includes(q.toLowerCase()));
  const exportera = () => download('Akare.xlsx', writeXlsx([{ name: 'Åkare', rows: [['Åkeri', 'Org.nr', 'Bilar', 'Kontakt', 'Appar', 'Avräkning öppnad', 'Senast inloggad'], ...L.map(x => [x.name, x.org_nr, (bilar.get(x.name) || []).length, x.owner_name || 'Inbjudan skickad', x.apps.map((k: string) => APPNAMN[k] || k).join(', '), x.opened_at ? String(x.opened_at).slice(0, 10) : '', x.last_login ? String(x.last_login).slice(0, 10) : ''])] }]));
  return (
    <>
      <div className="pf-head">
        <div className="ba-grow"><h1 className="pf-h1">Åkare</h1><p className="pf-lead">{L.length} åkerier är kopplade till {a.tenant.name}. De har egna konton och egen data.</p></div>
        <Button icon="download" onClick={exportera}>Exportera</Button>
        {a.canWrite && <Button variant="primary" icon="plus" onClick={() => setInvite(true)}>Bjud in åkare</Button>}
      </div>
      <div className="pf-filters">
        <Segmented label="Visa" value={filter} onChange={setFilter} options={[{ value: 'alla', label: `Alla ${L.length}` }, { value: 'ej', label: `Har inte öppnat ${ej.length}` }, { value: 'inbjudna', label: `Inbjudna ${inb.length}` }]} />
        <label className="pf-searchbox"><Icon name="search" size={14} /><input placeholder="Sök åkeri, org.nr eller bil" value={q} onChange={e => setQ(e.target.value)} aria-label="Sök åkeri, org.nr eller bil" /></label>
      </div>
      <div className="ba-table-wrap">
        <table className="ba-table">
          <thead><tr><th>Åkeri</th><th className="n">Bilar</th><th>Kontakt</th><th>Appar</th><th>{last ? `${manad(last.period).replace(/^./, c => c.toUpperCase())}s avräkning` : 'Avräkning'}</th><th>Senast inloggad</th></tr></thead>
          <tbody>
            {shown.map(x => (
              <tr key={x.tenant_id}>
                <td><div className="ba-who"><Avatar text={initialer(x.name)} size="sm" /><div><b>{x.name}</b><small>{x.org_nr}</small></div></div></td>
                <td className="n">{(bilar.get(x.name) || []).length || x.bilar || ''}</td>
                <td className="small">{x.invited ? 'Inbjudan skickad' : x.owner_name ? 'Ägare: ' + x.owner_name.split(' ')[0] : ''}</td>
                <td>{x.invited ? <span className="small muted">väntar</span> : <div className="ba-row" style={{ gap: 6 }}>{x.apps.filter((k: string) => k !== 'forarlista').map((k: string) => <span key={k} className="ba-tag">{APPNAMN[k] || k}</span>)}</div>}</td>
                <td>{x.invited ? <Pill tone="info">Inbjuden</Pill> : x.opened_at ? <Pill tone="ok">Öppnad</Pill> : <Pill tone="warn">Ej öppnad</Pill>}</td>
                <td className="small">{x.last_login ? relativDag(x.last_login) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pf-lock" style={{ marginTop: 16 }}>
        <Icon name="lock" /><span className="ba-grow"><b>Det här ser ni om era åkare.</b> Namn, bilar, aktiva appar och om avräkningen är öppnad. Åkarnas lön, personal och bokföring är deras egen och syns inte här.</span>
      </div>
      {invite && <BjudIn onClose={() => setInvite(false)} />}
    </>
  );
}

function BjudIn({ onClose }: { onClose: () => void }) {
  const a = useAccount(); const b = useBackend(); const toast = useToast(); const qc = useQueryClient();
  const offers = useOffers(a.tenant.id);
  const valbara = (offers.data || []).filter(o => o.mode !== 'av' && moduleByKey[o.module_key]?.status !== 'kommer');
  const [f, setF] = useState({ name: '', org_nr: '', email: '' });
  const [mods, setMods] = useState<string[] | null>(null);
  const val = mods ?? valbara.filter(o => o.mode === 'ingar').map(o => o.module_key);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) { toast('Fyll i företagets namn och en e-postadress.', { tone: 'bad' }); return; }
    setBusy(true);
    try { await b.createInvite(a.tenant.id, { ...f, modules: val }); qc.invalidateQueries(); toast(`Inbjudan skickad till ${f.email}.`); await b.setGuideStep(a.tenant.id, 'avrakning', 'akarna', true); onClose(); }
    catch (e: any) { toast(e.message, { tone: 'bad' }); }
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} title="Bjud in åkare" labelledBy="bjud-h" footer={<><Button onClick={onClose}>Avbryt</Button><Button variant="primary" icon="send" loading={busy} onClick={send}>Skicka inbjudan</Button></>}>
      <div className="ba-stack">
        <p className="small muted" style={{ margin: 0 }}>Åkaren får ett mejl med en länk. När ägaren loggar in kopplas åkeriet till {a.tenant.name} och får de appar ni har valt.</p>
        <TextField label="Företag" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Åkeri Exempel AB" />
        <TextField label="Organisationsnummer" value={f.org_nr} onChange={e => setF({ ...f, org_nr: e.target.value })} placeholder="559000-0001" mono />
        <TextField label="E-post till ägaren" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="namn@akeri.se" />
        <div className="ba-field"><span className="ba-label">Appar</span>{valbara.map(o => <Checkbox key={o.module_key} label={`${APPNAMN[o.module_key] || o.module_key} (${o.mode === 'ingar' ? 'ingår' : 'tillval, åkaren betalar'})`} checked={val.includes(o.module_key)} onChange={e => setMods(e.target.checked ? [...val, o.module_key] : val.filter(k => k !== o.module_key))} />)}</div>
      </div>
    </Modal>
  );
}
export { Card };

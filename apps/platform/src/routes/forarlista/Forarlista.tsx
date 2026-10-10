// Förarlista (sidan 34) och Mina förare. Varning när taxiförarlegitimationen snart går ut.
import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, EmptyState, Icon, Kpi, Pill, Segmented, useToast } from '@bolagsappar/ui';
import { writeXlsx } from '@bolagsappar/core/filetypes';
import { initialer, manad, tal } from '@bolagsappar/core/format';
import { useAccount } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useDoc, useLicenses, useSharesTo } from '../../lib/q';
import { download } from '../../lib/files';
import { usePage, useWelcome } from '../../shell/Help';
import { Loading } from '../../shell/Shell';

const legStatus = (leg: string, idag = new Date()) => {
  if (!leg) return 'okand';
  const [y, m] = leg.split('-').map(Number); const slut = new Date(y, m, 0);
  const dagar = (slut.getTime() - idag.getTime()) / 864e5;
  return dagar < 0 ? 'utgangen' : dagar <= 60 ? 'snart' : 'ok';
};

export function Forarlista() {
  const a = useAccount();
  const q = useDoc<any>(a.tenant.id, 'forarlista', 'lista');
  useWelcome('forarlista', 'main');
  usePage({ crumbs: ['Förarlista'], module: 'forarlista', variant: 'main', view: 'lista' }, []);
  if (q.isLoading) return <Loading />;
  return <Lista data={q.data} main />;
}
export function MinaForare() {
  const a = useAccount();
  const sh = useSharesTo(a.tenant.id, 'forarlista');
  useWelcome('forarlista', 'sub');
  usePage({ crumbs: ['Mina förare'], module: 'forarlista', variant: 'sub', view: 'lista' }, []);
  if (sh.isLoading) return <Loading />;
  return <Lista data={sh.data?.[0]?.payload || null} />;
}

function Lista({ data, main }: { data: any; main?: boolean }) {
  const a = useAccount(); const b = useBackend(); const toast = useToast(); const qc = useQueryClient();
  const lic = useLicenses(a.tenant.id);
  const harKassan = (lic.data || []).some(l => l.module_key === 'kassan' && l.status === 'aktiv');
  const [status, setStatus] = useState<'aktiv' | 'inaktiv' | 'alla'>('aktiv');
  const [grupp, setGrupp] = useState<'alla' | 'per'>('alla');
  const [q, setQ] = useState('');
  const [n, setN] = useState(100);
  const L: any[] = data?.forare || [];
  const man = new Date().toISOString().slice(0, 7);
  const rows = useMemo(() => L.filter(f => status === 'alla' || f.status === status).filter(f => !q || [f.namn, f.nr, f.senasteBil, f.akeri].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) => grupp === 'per' ? x.akeri.localeCompare(y.akeri, 'sv') || x.namn.localeCompare(y.namn, 'sv') : x.namn.localeCompare(y.namn, 'sv', { numeric: true })), [L, status, q, grupp]);
  if (!data) return <EmptyState icon="users" title={main ? 'Koppla TaxiCaller' : 'Inga förare än'}>{main ? 'Förarna hämtas från TaxiCaller varje natt när API-nyckeln är inlagd under Inställningar.' : 'Dina förare kommer från centralens förarlista.'}</EmptyState>;
  const aktiva = L.filter(f => f.status === 'aktiv'), snart = aktiva.filter(f => legStatus(f.leg) !== 'ok');
  const hamta = async () => {
    try { await b.setDoc(a.tenant.id, 'forarlista', 'lista', { ...data, hamtad: new Date().toISOString().slice(0, 19) }); qc.invalidateQueries({ queryKey: ['documents'] }); toast('Förarlistan är hämtad från TaxiCaller.'); }
    catch (e: any) { toast(e.message, { tone: 'bad' }); }
  };
  const xl = () => download('Forarlista.xlsx', writeXlsx([{ name: 'Förare', rows: [['Förarnr', 'Förare', 'Åkeri', 'Senaste bil', 'Legitimation', 'Status', 'Pass ' + manad(man)], ...rows.map(f => [f.nr, f.namn, f.akeri, f.senasteBil, f.leg, f.status, f.pass])] }]));
  let prev = '';
  return (
    <>
      <div className="pf-head">
        <div className="ba-grow"><h1 className="pf-h1">{main ? 'Förarlista' : 'Mina förare'}</h1><p className="pf-lead">Hämtas från TaxiCaller varje natt. Senast {String(data.hamtad).slice(11, 16)} {String(data.hamtad).slice(0, 10) === new Date().toISOString().slice(0, 10) ? 'i dag' : String(data.hamtad).slice(0, 10)}.</p></div>
        {main && a.canWrite && <Button icon="refresh" onClick={hamta}>Hämta nu</Button>}
        <Button icon="download" onClick={xl}>Excel</Button>
        {!main && harKassan && <Link className="ba-btn" to="/$tenant/akarkassan" params={{ tenant: a.tenant.slug }}>Koppla till lön</Link>}
      </div>
      <div className="ba-grid ba-grid--4">
        <Kpi label="Aktiva förare" value={tal(aktiva.length)} sub="senaste 30 dagarna" />
        <Kpi label="Inaktiva" value={tal(L.length - aktiva.length)} sub="ingen körning på 90 dagar" />
        <Kpi label="Legitimation går ut" value={tal(snart.length)} sub="inom 60 dagar" subTone="warn" />
        <Kpi label="Utan bil" value={tal(aktiva.filter(f => f.utanBil).length)} sub="inloggade utan bil" />
      </div>
      <div className="pf-filters">
        <Segmented label="Status" value={status} onChange={setStatus} options={[{ value: 'aktiv', label: 'Aktiva' }, { value: 'inaktiv', label: 'Inaktiva' }, { value: 'alla', label: 'Alla' }]} />
        {main && <Segmented label="Gruppera" value={grupp} onChange={setGrupp} options={[{ value: 'alla', label: 'Alla åkare' }, { value: 'per', label: 'Per åkare' }]} />}
        <label className="pf-searchbox"><Icon name="search" size={14} /><input placeholder="Sök förare, förarnr eller bil" value={q} onChange={e => setQ(e.target.value)} aria-label="Sök förare, förarnr eller bil" /></label>
      </div>
      <div className="ba-table-wrap">
        <table className="ba-table">
          <thead><tr><th>Förare</th>{main && <th>Åkeri</th>}<th>Senaste bil</th><th>Legitimation</th><th>Status</th><th className="n">{manad(man).replace(/^./, c => c.toUpperCase())}</th></tr></thead>
          <tbody>
            {rows.slice(0, n).map(f => {
              const ls = legStatus(f.leg); const head = grupp === 'per' && f.akeri !== prev ? (prev = f.akeri) : null;
              return [
                head && <tr key={'h' + head}><td colSpan={6} style={{ background: 'var(--subtle)', fontWeight: 700, fontSize: 12.5 }}>{head}</td></tr>,
                <tr key={f.nr}>
                  <td><div className="ba-who"><Avatar size="sm" round text={/^Förare\s+\S{1,3}$/.test(f.namn) ? f.namn.replace(/^Förare\s+/, '') : initialer(f.namn)} /><div><b>{f.namn}</b><small>nr {f.nr}</small></div></div></td>
                  {main && <td className="small">{f.akeri}</td>}
                  <td className="num">{f.senasteBil ? f.senasteBil.slice(0, 3) + ' ' + f.senasteBil.slice(3) : ''}</td>
                  <td className="small">Taxiförarleg. till {f.leg}</td>
                  <td>{f.status !== 'aktiv' ? <Pill tone="bad">Inaktiv</Pill> : ls === 'snart' ? <Pill tone="warn">Går ut snart</Pill> : ls === 'utgangen' ? <Pill tone="bad">Utgången</Pill> : <Pill tone="ok">Aktiv</Pill>}</td>
                  <td className="n">{f.pass} pass</td>
                </tr>
              ];
            })}
          </tbody>
        </table>
      </div>
      {rows.length > n && <div style={{ marginTop: 12 }}><Button onClick={() => setN(n + 200)}>Visa fler ({rows.length - n} kvar)</Button></div>}
    </>
  );
}

// Inställningar för Avräkning: priser, åkare, bilar (med bilregistret) och terminaler. Samma fält som i prototypen.
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Button, Card, DropZone, Icon, Input, TextField, useToast } from '@bolagsappar/ui';
import { normRows, importBilregister } from '@bolagsappar/core/avrakning';
import { useAccount } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useSettings, M } from '../../lib/avr';
import { usePage } from '../../shell/Help';
import { Loading } from '../../shell/Shell';

const PARAMS: [string, string][] = [['vx', 'Växelavgift per bil (kr exkl moms)'], ['tl', 'Taklampa per bil (kr exkl moms)'], ['sa', 'Serviceavgift (andel, 0,03 = 3 %)'], ['m6', 'Moms persontransport'], ['m25', 'Moms bud och avgifter'], ['bro', 'Øresundsbron per passage (kr)'], ['sturup', 'Sturup per passage (kr)'], ['cph', 'CPH parkering, lägsta pris per gång (kr)'], ['fs', 'Spec per förare, per bil och månad (kr exkl moms)'], ['fsGratis', 'Provmånad spec per förare för alla (ÅÅÅÅ-MM)'], ['skuldGrans', 'Gräns för hög skuld hos åkare (kr)']];
const COLS: Record<string, [string, string, string?][]> = {
  bolag: [['namn', 'Bolag', 'w'], ['kn', 'Kundnr'], ['mail', 'E-post', 'w'], ['vx', 'Växelavgift, antal'], ['tl', 'Taklampa, antal'], ['vxInn', 'Innevarande (1)'], ['vxRab', 'Rabatt %'], ['gratisTom', 'Gratis t.o.m.'], ['fsFrom', 'Spec per förare från']],
  bilar: [['bil', 'Bil'], ['reg', 'Reg nr'], ['bolag', 'Åkeri', 'w'], ['avr', 'Avräknas på', 'w'], ['kommentar', 'Kommentar', 'w']],
  terminaler: [['id', 'Terminal-id', 'w'], ['bil', 'Bil'], ['kommentar', 'Kommentar', 'w']],
  kassor: [['kassor', 'Kassör'], ['bil', 'Bil'], ['kommentar', 'Kommentar', 'w']]
};
const TABS = [['params', 'Priser'], ['bolag', 'Åkare'], ['bilar', 'Bilar'], ['terminaler', 'Terminaler och kassörer']] as const;

export function AvrInstallningar() {
  const a = useAccount(); const b = useBackend(); const toast = useToast(); const qc = useQueryClient();
  const { S, loading } = useSettings(a.tenant.id);
  const [tab, setTab] = useState<string>('params');
  const [E, setE] = useState<any>(null);
  const [q, setQ] = useState('');
  usePage({ crumbs: ['Avräkning', 'Inställningar'], module: 'avrakning', variant: 'main', view: 'installningar' }, []);
  useEffect(() => { if (S && !E) setE(JSON.parse(JSON.stringify({ params: S.params, bolag: S.bolag, bilar: S.bilar, terminaler: S.terminaler, kassor: S.kassor }))); }, [S, E]);
  if (loading || !E) return <Loading />;
  const save = async (key: string) => {
    try {
      if (key === 'params') await b.setDoc(a.tenant.id, M, 'settings/params', Object.fromEntries(Object.entries(E.params).map(([k, v]: any) => [k, k === 'fsGratis' ? v : (v === '' ? '' : +String(v).replace(',', '.'))])));
      else if (key === 'terminaler') await b.setDoc(a.tenant.id, M, 'settings/terminaler', { terminaler: normRows('terminaler', E.terminaler), kassor: normRows('kassor', E.kassor) });
      else await b.setDoc(a.tenant.id, M, 'settings/' + key, { list: normRows(key, E[key]) });
      if (key === 'bilar') await b.setGuideStep(a.tenant.id, M, 'bilar', true);
      if (key === 'params') await b.setGuideStep(a.tenant.id, M, 'priser', true);
      qc.invalidateQueries({ queryKey: ['documents'] }); setE(null); toast('Sparat. Gäller nästa månad du räknar.');
    } catch (e: any) { toast(e.code === 'not_granted' ? 'Du har inte behörighet att ändra inställningarna.' : e.message, { tone: 'bad' }); }
  };
  const importReg = async (files: File[]) => {
    const wb = XLSX.read(await files[0].arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });
    const r = importBilregister(E.bilar, rows as any[]);
    setE({ ...E, bilar: r.bilar }); toast(`${r.ny} nya bilar och ${r.upd} ändrade. Kontrollera och klicka Spara.`);
  };
  const Table = ({ k }: { k: string }) => {
    const rows: any[] = E[k]; const cols = COLS[k];
    const vis = rows.map((r, i) => ({ r, i })).filter(({ r }) => !q || cols.some(([c]) => String(r[c] ?? '').toLowerCase().includes(q.toLowerCase())));
    return (
      <div className="ba-table-wrap">
        <table className="ba-table">
          <thead><tr>{cols.map(([c, l]) => <th key={c}>{l}</th>)}<th /></tr></thead>
          <tbody>{vis.map(({ r, i }) => <tr key={i}>{cols.map(([c, l, w]) => <td key={c} style={{ padding: '6px 8px' }}><Input value={r[c] ?? ''} aria-label={l} mono={!w} style={{ height: 34, minWidth: w ? 180 : 80 }} onChange={e => setE({ ...E, [k]: rows.map((x, j) => j === i ? { ...x, [c]: e.target.value } : x) })} /></td>)}<td><Button size="sm" variant="link" onClick={() => setE({ ...E, [k]: rows.filter((_, j) => j !== i) })}>Ta bort</Button></td></tr>)}</tbody>
        </table>
      </div>
    );
  };
  const head = (k: string, extra?: React.ReactNode) => (
    <div className="pf-filters" style={{ marginTop: 0 }}>
      {k !== 'params' && <label className="pf-searchbox" style={{ marginLeft: 0 }}><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Sök" aria-label="Sök" /></label>}
      <span className="ba-grow" />{extra}
      {k !== 'params' && <Button icon="plus" onClick={() => setE({ ...E, [k === 'terminaler' ? 'terminaler' : k]: [...E[k === 'terminaler' ? 'terminaler' : k], {}] })}>Lägg till rad</Button>}
      {a.canWrite && <Button variant="dark" onClick={() => save(k)}>Spara</Button>}
    </div>
  );
  return (
    <>
      <div className="pf-head"><div className="ba-grow"><div className="pf-eyebrow">Avräkning</div><h1 className="pf-h1">Inställningar</h1><p className="pf-lead">Priser, åkare, bilar och terminaler. Ändringar gäller nästa månad du räknar. Publicerade månader påverkas inte.</p></div></div>
      <nav className="ba-tabs" role="tablist" style={{ marginBottom: 16 }}>{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setQ(''); }}>{l}</button>)}</nav>
      {tab === 'params' && <>{head('params')}<Card><div className="ba-grid ba-grid--2">{PARAMS.map(([k, l]) => <TextField key={k} label={l} mono value={E.params[k] ?? ''} onChange={e => setE({ ...E, params: { ...E.params, [k]: e.target.value } })} />)}</div></Card></>}
      {tab === 'bolag' && <>{head('bolag')}<Table k="bolag" /></>}
      {tab === 'bilar' && <>{head('bilar')}<div style={{ marginBottom: 12 }}><DropZone compact title="Läs in bilregistret (Excel)" onFiles={importReg} accept=".xlsx,.xls,.csv" multiple={false} /></div><Table k="bilar" /></>}
      {tab === 'terminaler' && <>{head('terminaler')}<div className="ba-grid ba-grid--2"><Table k="terminaler" /><Table k="kassor" /></div></>}
    </>
  );
}

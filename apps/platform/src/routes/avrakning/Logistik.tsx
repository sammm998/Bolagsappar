// Avräkning för logistik (exempel: Jetpack). Samma plattform och samma publicering som taxi, med andra ord:
// uppdrag i stället för körningar, underleverantörer i stället för åkare. All beräkning i packages/core/logistik.
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banner, Button, Card, DropZone, EmptyState, Kpi, Pill, Select, useToast } from '@bolagsappar/ui';
import { parseUppdrag, avraknaLogistik, logistikPayload, LOGISTIK_DEF } from '@bolagsappar/core/logistik';
import { kr2, kr0, manadAr, ymAdd } from '@bolagsappar/core/format';
import { useAccount } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useDoc, usePeriods } from '../../lib/q';
import { readLocal, download } from '../../lib/files';
import { usePage, useHelpState } from '../../shell/Help';
import { Loading } from '../../shell/Shell';

const M = 'avrakning';

export function Logistik() {
  const a = useAccount(); const b = useBackend(); const qc = useQueryClient(); const toast = useToast(); const help = useHelpState();
  const t = a.tenant.id;
  const per = usePeriods(t, M);
  const kids = useQuery<any[]>({ queryKey: ['tenants', 'children', t], queryFn: () => b.children(t) });
  const inst = useDoc<any>(t, M, 'settings/logistik');
  const P = useMemo(() => {
    const L = (per.data || []).map(x => x.period);
    const sista = L.sort().slice(-1)[0];
    const nasta = sista ? ymAdd(sista, 1) : new Date().toISOString().slice(0, 7);
    return [...new Set([nasta, ...L])].sort().reverse();
  }, [per.data]);
  const [valt, setValt] = useState<string | null>(null);
  const period = valt || (per.data || []).find(x => x.status !== 'publicerad')?.period || P[0];
  const doc = useDoc<any>(t, M, period ? 'logistik/' + period : undefined);
  const status = (per.data || []).find(x => x.period === period);
  const [busy, setBusy] = useState(false);
  usePage({ crumbs: ['Avräkning', 'Uppdrag'], module: 'avrakning', variant: 'main', view: 'uppdrag', fileHelp: { app: 'logistik', key: 'uppdrag' } }, []);
  const UL = useMemo(() => (kids.data || []).map(k => ({ id: k.id, namn: k.name })), [kids.data]);
  const R = useMemo(() => (doc.data?.rader && period ? avraknaLogistik(doc.data.rader, { period, underleverantorer: UL, cfg: inst.data?.cfg || LOGISTIK_DEF }) : null), [doc.data, period, UL, inst.data]);
  if (per.isLoading || kids.isLoading || !period) return <Loading />;
  const last = status?.status === 'publicerad' || status?.status === 'godkand';

  const lasIn = async (files: File[]) => {
    try {
      const r = await readLocal(files[0]);
      const text = r.text || r.csvText || '';
      const x = parseUppdrag(text);
      if (!x) { toast(`${files[0].name} ser inte ut som en uppdragsfil. Kolumnerna uppdrags-id, underleverantör och pris behövs.`, { tone: 'bad' }); if (!help.open) help.toggle(); return; }
      await b.setDoc(t, M, 'logistik/' + period, { fil: files[0].name, rader: x.rader, inlast: new Date().toISOString() });
      qc.invalidateQueries({ queryKey: ['documents', t, M] });
      toast(`${x.rader.length} uppdrag inlästa från ${files[0].name}.${x.fel.length ? ` ${x.fel.length} rader har fel.` : ''}`);
    } catch (e: any) { toast(e.message, { tone: 'bad' }); }
  };
  const exempelfil = async () => {
    const { jetpackUppdragCsv } = await import('@bolagsappar/core/testdata');
    download(`uppdrag_exempel_${period}.csv`, jetpackUppdragCsv({ period }), 'text/csv');
  };
  const godkann = async () => { setBusy(true); try { await b.approvePeriod(t, M, period); qc.invalidateQueries({ queryKey: ['periods'] }); toast(`${manadAr(period)} är godkänd och låst.`); } catch (e: any) { toast(e.message, { tone: 'bad' }); } setBusy(false); };
  const publicera = async () => {
    if (!R) return; setBusy(true);
    try {
      const items = R.per.map(x => ({ to: x.id, kind: 'logistikavrakning', payload: logistikPayload(x, R, { fran: a.tenant.name }), title: `Avräkningen för ${manadAr(period).toLowerCase()} är klar`, body: `${a.tenant.name} har publicerat avräkningen.`, link: `/min-avrakning/${period}` }));
      const n = await b.publish(t, M, period, items);
      qc.invalidateQueries(); toast(`Publicerat till ${n} underleverantörer.`);
    } catch (e: any) { toast(e.message, { tone: 'bad' }); }
    setBusy(false);
  };

  return (
    <>
      <div className="pf-head">
        <div className="ba-grow"><div className="pf-eyebrow">Avräkning · uppdrag</div><h1 className="pf-h1">{manadAr(period)}</h1><p className="pf-lead">Läs in uppdragsfilen. Varje underleverantör får sin avräkning: uppdragens värde minus provision och avgifter.</p></div>
        <Select value={period} onChange={e => setValt(e.target.value)} aria-label="Månad" style={{ width: 180 }}>{P.map(p => <option key={p} value={p}>{manadAr(p)}</option>)}</Select>
        {status?.status === 'publicerad' ? <Pill tone="ok">Publicerad</Pill> : status?.status === 'godkand' ? <Pill tone="info">Godkänd</Pill> : <Pill tone="warn">Pågår</Pill>}
      </div>
      <div style={{ marginBottom: 14 }}><Banner tone="info">Exempel på hur en logistikkund passar in. Avgifterna och filens kolumner stäms av med Jetpack. Provision {Math.round((inst.data?.cfg?.provision ?? LOGISTIK_DEF.provision) * 100)} %, {kr0(inst.data?.cfg?.perUppdrag ?? LOGISTIK_DEF.perUppdrag)} kr per uppdrag och {kr0(inst.data?.cfg?.perFordon ?? LOGISTIK_DEF.perFordon)} kr per fordon och månad.</Banner></div>
      {!last && <div style={{ marginBottom: 16 }}><DropZone title="Dra in uppdragsfilen här" text={doc.data ? `Inläst: ${doc.data.fil}, ${doc.data.rader.length} rader. En ny fil ersätter den.` : 'CSV från transportsystemet. Filen läses i din webbläsare.'} onFiles={lasIn} accept=".csv,.txt,.xlsx" multiple={false} /></div>}
      {!doc.data ? (
        <EmptyState icon="upload" title="Ingen uppdragsfil för månaden" action={<Button onClick={exempelfil} icon="download">Ladda ner en exempelfil</Button>}>Dra in månadens uppdrag ovan. Vill du se hur filen ska se ut, ladda ner exemplet och dra in det.</EmptyState>
      ) : R && (
        <>
          <div className="ba-grid ba-grid--4" style={{ marginBottom: 16 }}>
            <Kpi label="Uppdrag" value={R.summa.antal} sub={doc.data.fil} />
            <Kpi label="Uppdragens värde" value={kr0(R.summa.intakt) + ' kr'} sub="exkl. moms" />
            <Kpi label="Att betala ut" value={kr0(-R.summa.att) + ' kr'} sub={`till ${R.per.length} underleverantörer, inkl. moms`} />
            <Kpi label="Att titta på" value={R.varningar.length + R.utan.length} sub={R.varningar.length + R.utan.length ? 'se listan' : 'inget'} subTone={R.varningar.length ? 'warn' : undefined} />
          </div>
          {(R.varningar.length > 0 || R.utan.length > 0) && <Card title="Att titta på" className="pf-section"><ul className="pf-list-plain small" style={{ display: 'grid', gap: 6 }}>{R.varningar.map((v: any, i: number) => <li key={i}><Pill tone={v.typ === 'okand' ? 'bad' : 'warn'} dot={false}>{v.typ === 'okand' ? 'Okänd' : v.typ === 'dubblett' ? 'Dubblett' : 'Fel månad'}</Pill> {v.text}</li>)}{R.utan.map((n: string) => <li key={n}><Pill dot={false}>Inga uppdrag</Pill> {n} har inga uppdrag den här månaden.</li>)}</ul></Card>}
          <div className="ba-table-wrap" style={{ marginTop: 16 }}><table className="ba-table">
            <thead><tr><th>Underleverantör</th><th className="n">Uppdrag</th><th className="n">Värde</th><th className="n">Provision</th><th className="n">Avgifter</th><th className="n">Netto</th><th className="n">Moms</th><th className="n">Att få</th></tr></thead>
            <tbody>{R.per.map((x: any) => <tr key={x.id}><td className="b">{x.namn}<div className="small muted">{x.fordon.filter((f: any) => f.reg).length} fordon</div></td><td className="n">{x.antal}</td><td className="n">{kr2(x.intakt)}</td><td className="n">{kr2(-x.provision)}</td><td className="n">{kr2(-(x.uppdragsavgift + x.fordonsavgift))}</td><td className="n">{kr2(x.netto)}</td><td className="n">{kr2(x.moms)}</td><td className="n strong">{kr2(-x.att)}</td></tr>)}</tbody>
            <tfoot><tr><td>Summa</td><td className="n">{R.summa.antal}</td><td className="n">{kr2(R.summa.intakt)}</td><td colSpan={4} /><td className="n">{kr2(-R.summa.att)}</td></tr></tfoot>
          </table></div>
          <div className="ba-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
            {!a.canApprove && <span className="small muted">Din roll får inte godkänna eller publicera.</span>}
            {status?.status !== 'publicerad' && status?.status !== 'godkand' && <Button variant="primary" icon="check" loading={busy} disabled={!a.canApprove || !R.per.length} onClick={godkann}>Godkänn {manadAr(period).toLowerCase()}</Button>}
            {status?.status === 'godkand' && <Button variant="primary" icon="send" loading={busy} disabled={!a.canApprove} onClick={publicera}>Publicera till {R.per.length} underleverantörer</Button>}
          </div>
        </>
      )}
    </>
  );
}

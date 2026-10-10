// Min avräkning (sidan 36). Samma siffror som centralen publicerade, i åkarens språk: att få eller att betala.
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Bars, Button, Card, EmptyState, Icon, Modal, Pill, Segmented, Textarea, useToast, Banner } from '@bolagsappar/ui';
import { kr2, kortManad, manadAr, Manad, ymAdd } from '@bolagsappar/core/format';
import { useAccount } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useSharesTo } from '../../lib/q';
import { avrakningPdf } from '../../lib/pdf';
import { download } from '../../lib/files';
import { usePage, useWelcome } from '../../shell/Help';
import { Loading } from '../../shell/Shell';

export function MinAvrakning() {
  const a = useAccount(); const b = useBackend(); const qc = useQueryClient(); const toast = useToast();
  const { period } = useParams({ strict: false }) as { period?: string };
  const q = useSharesTo(a.tenant.id, 'avrakning');
  const shares = q.data || [];
  const sh = shares.find(s => s.period === period) || null;
  const [rad, setRad] = useState<any>(null);
  const [fraga, setFraga] = useState<string | null>(null);
  const nav = useNavigate();
  const hist = useHist(shares, period || shares[0]?.period || '2026-01');
  useWelcome('avrakning', 'sub');
  usePage({ crumbs: ['Min avräkning', ...(period ? [Manad(period)] : [])], module: 'avrakning', variant: 'sub', view: 'manad' }, [period]);
  useEffect(() => { if (sh && !sh.opened_at && !a.isDriver) b.markOpened(sh.id).then(() => qc.invalidateQueries({ queryKey: ['shares'] })).catch(() => {}); }, [sh?.id]);
  if (q.isLoading) return <Loading />;
  if (!period && shares[0]) return <Navigate to="/$tenant/min-avrakning/$period" params={{ tenant: a.tenant.slug, period: shares[0].period }} />;
  if (!sh) return <EmptyState icon="receipt" title="Ingen avräkning än">Du får en notis när {a.parent?.name || 'centralen'} publicerar månaden. Då syns den här, med PDF och raderna per bil.</EmptyState>;
  const p = sh.payload;
  const senaste = shares.slice(0, 3).map(s => s.period).reverse();
  const fragaCentralen = async () => {
    if (!fraga?.trim()) return;
    try { await b.createTicket(a.tenant.id, `Fråga om ${manadAr(period!).toLowerCase()}: ${fraga.trim().slice(0, 140)}`); toast(`Frågan är skickad till ekonomi hos ${p.fran}.`); setFraga(null); }
    catch (e: any) { toast(e.message, { tone: 'bad' }); }
  };
  return (
    <>
      <div className="pf-head">
        <div className="ba-grow"><div className="pf-eyebrow">Min avräkning · från {p.fran}</div><h1 className="pf-h1">{manadAr(period!)}</h1></div>
        <Segmented label="Månad" value={period!} options={senaste.map(x => ({ value: x, label: kortManad(x) }))} onChange={v => nav({ to: '/$tenant/min-avrakning/$period', params: { tenant: a.tenant.slug, period: v } })} />
        <Button icon="download" onClick={() => download(`Avrakning_${p.namn.replace(/\s+/g, '_')}_${period}.pdf`, avrakningPdf(p))}>PDF</Button>
      </div>
      {p.version > 1 && <div style={{ marginBottom: 14 }}><Banner tone="info">Rättad version {p.version}. Orsak: {p.orsak || 'ej angiven'}.</Banner></div>}
      <div className="pf-two">
        <Card title="Sammanfattning" headExtra={<Pill tone="ok">{p.riktning === 'betalar' ? 'Betalas senast' : 'Utbetalas'} {p.utbetalas}</Pill>}>
          <dl className="pf-kv">
            {p.sammanfattning.map((r: any) => <div key={r.key} onClick={() => setRad(r)} style={{ cursor: 'pointer' }} title="Klicka för att se hur raden räknas"><dt>{r.text}{r.n ? <span className="muted small"> · {r.n} passager</span> : null}</dt><dd>{kr2(r.belopp)} kr</dd></div>)}
            <div className="tot"><dt>{p.riktning === 'betalar' ? 'Att betala' : 'Att få'}</dt><dd>{kr2(p.belopp)} kr</dd></div>
          </dl>
          <div className="ba-card ba-card--subtle" style={{ padding: 12, marginTop: 14, fontSize: 12 }}><b>Stämmer något inte?</b> Klicka på en rad och välj "Fråga {p.fran}". Frågan hamnar hos ekonomi på centralen.</div>
        </Card>
        <div className="ba-stack">
          <Card title="Per bil">
            <div className="ba-table-wrap" style={{ border: 0 }}>
              <table className="ba-table"><thead><tr><th>Bil</th><th className="n">Intäkt</th><th className="n">Avdrag</th><th className="n">Netto</th></tr></thead>
                <tbody>{p.perBil.map((x: any) => <tr key={x.bil}><td className="b num">{x.reg ? x.reg.slice(0, 3) + ' ' + x.reg.slice(3) : x.bil}<div className="small muted">Bil {x.bil}</div></td><td className="n">{kr2(x.intakt)}</td><td className="n">{kr2(x.avdrag)}</td><td className="n strong">{kr2(x.netto)}</td></tr>)}</tbody></table>
            </div>
            <p className="small muted" style={{ margin: '8px 0 0' }}>Netto per bil är före centralens avgifter, förskott och moms.</p>
          </Card>
          <Card title="Senaste sex månaderna" headExtra={<span className="small muted ba-grow" style={{ textAlign: 'right' }}>att få per månad</span>}>
            <Bars tall values={hist.map(h => h.v)} labels={hist.map(h => kortManad(h.p))} />
          </Card>
        </div>
      </div>
      <Modal open={!!rad} onClose={() => setRad(null)} title={rad?.text} labelledBy="rad-h" footer={<><Button onClick={() => setRad(null)}>Stäng</Button><Button variant="dark" icon="mail" onClick={() => { setFraga(`${rad.text}: `); setRad(null); }}>Fråga {p.fran}</Button></>}>
        {rad && <RadDetalj p={p} rad={rad} />}
      </Modal>
      <Modal open={fraga != null} onClose={() => setFraga(null)} title={`Fråga ${p.fran}`} labelledBy="fraga-h" footer={<><Button onClick={() => setFraga(null)}>Avbryt</Button><Button variant="primary" icon="send" onClick={fragaCentralen}>Skicka frågan</Button></>}>
        <Textarea value={fraga || ''} onChange={e => setFraga(e.target.value)} rows={4} aria-label="Din fråga" />
      </Modal>
    </>
  );
}

function useHist(shares: any[], period: string) {
  return useMemo(() => { const L: { p: string; v: number }[] = []; for (let i = 5; i >= 0; i--) { const p = ymAdd(period, -i); const s = shares.find(x => x.period === p); L.push({ p, v: s ? -s.payload.att : 0 }); } return L; }, [shares, period]);
}

const GRUPP: Record<string, (r: any) => boolean> = {
  intakt: r => [50, 51, 52, 54, 55, 56].includes(r.art), avgifter: r => [1, 8, 53, 57].includes(r.art), bro: r => r.art === 16 || r.art === 17,
  sturup: r => r.art === 15, forskott: r => r.art === 59, skuld: r => r.skuld, ovrigt: r => r.art == null && !r.skuld, avrundning: () => false
};
function RadDetalj({ p, rad }: { p: any; rad: any }) {
  const rows = p.rows.filter(GRUPP[rad.key] || (() => false));
  if (rad.key === 'avrundning') return <p className="small">Moms räknas på summan av raderna och beloppet avrundas till hela kronor. Skillnaden mellan raderna och Att få hamnar här.</p>;
  return (
    <>
      <p className="small muted" style={{ marginTop: 0 }}>Raderna från fakturan, exklusive moms. Negativt belopp betyder att centralen betalar dig.</p>
      <div className="ba-table-wrap"><table className="ba-table"><thead><tr><th>Art</th><th>Benämning</th><th className="n">Antal</th><th className="n">À-pris</th><th className="n">Summa</th></tr></thead>
        <tbody>{rows.map((r: any, i: number) => <tr key={i}><td className="num">{r.art ?? ''}</td><td>{r.text}</td><td className="n">{r.antal}</td><td className="n">{kr2(r.apris)}</td><td className="n">{kr2(r.summa)}</td></tr>)}</tbody></table></div>
      {rad.key === 'bro' && p.passager?.bro?.length > 0 && <p className="small">Passagerna med tid finns i PDF:en och i Åkarkassan under Bro och Sturup.</p>}
    </>
  );
}
export { Icon, Link };

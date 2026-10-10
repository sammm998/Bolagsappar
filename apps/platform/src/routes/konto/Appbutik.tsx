// Appbutik (sidan 41). Huvudkundens val först, det som ingår är tydligt märkt.
// Aktivering är ett klick plus underskrift med pennan (ingen BankID). Menyn uppdateras direkt.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppIcon, Button, Card, EmptyState, Pill, Segmented, SignaturePad, TextField, Modal, useToast, type SignatureHandle } from '@bolagsappar/ui';
import { MODULES, variantFor, prisText } from '@bolagsappar/modules';
import { ymAdd, dagText } from '@bolagsappar/core/format';
import { useAccount } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useLicenses, useOffers } from '../../lib/q';
import { usePage } from '../../shell/Help';

const SUBTEXT: Record<string, string> = { avrakning: 'Din del av centralens avräkning, per bil och månad.', forarlista: 'Dina förare från {central}s förarlista.', kassan: 'Lön, kassa, bro och Sturup. Hämtar avräkningen själv.', skadeflode: 'Skadeärenden och mejl till skadereglerare.', korjournal: 'Körjournal för alla bilar, skapad från körningarna i TaxiCaller.', verkstad: 'Ärenden, offert, faktura och momsfaktura mot försäkringsbolag.' };

export function Appbutik() {
  const a = useAccount(); const lic = useLicenses(a.tenant.id);
  const offers = useOffers(a.tenant.type === 'sub' ? a.tenant.parent_id : null);
  const [tab, setTab] = useState<'alla' | 'fran' | 'aktiva'>('alla');
  const [akt, setAkt] = useState<any>(null);
  usePage({ crumbs: ['Appbutik'] }, []);
  const central = a.parent?.name || '';
  const has = (k: string) => (lic.data || []).find(l => l.module_key === k && l.status === 'aktiv');
  const offer = (k: string) => (offers.data || []).find(o => o.module_key === k);
  const mods = MODULES.filter(m => {
    const v = variantFor(m, a.tenant.type);
    if (!(m.variants as any)[v] || (m.variants as any)[v].erbjuds && a.tenant.type !== 'main') return false;
    if (a.tenant.type === 'sub') return offer(m.key)?.mode !== 'av' || has(m.key) || m.fran === 'Bolagsappar' || m.status === 'kommer';
    return true;
  });
  const shown = mods.filter(m => tab === 'aktiva' ? has(m.key) : tab === 'fran' ? !!offer(m.key) && offer(m.key).mode !== 'av' : true);
  const nya = mods.filter(m => m.status === 'ny');
  const kort = shown.filter(m => m.status !== 'ny');
  return (
    <>
      <div className="pf-head"><div className="ba-grow"><h1 className="pf-h1">Appbutik</h1><p className="pf-lead">{a.tenant.type === 'sub' ? `Appar som ${central} har valt för åkare, och appar från Bolagsappar.` : 'Appar från Bolagsappar. Nya behov blir nya appar.'}</p></div></div>
      {a.tenant.type === 'sub' && <div style={{ marginBottom: 14 }}><Segmented label="Visa" value={tab} onChange={setTab} options={[{ value: 'alla', label: 'Alla' }, { value: 'fran', label: `Från ${central}` }, { value: 'aktiva', label: 'Aktiva' }]} /></div>}
      <div className="ba-grid ba-grid--4">
        {kort.map(m => {
          const o = offer(m.key), aktiv = has(m.key), ingar = o?.mode === 'ingar' || (aktiv && aktiv.paid_by && aktiv.paid_by !== a.tenant.id);
          const v = variantFor(m, a.tenant.type);
          return (
            <Card key={m.key}>
              <div className="ba-stack" style={{ gap: 6 }}>
                <AppIcon icon={m.icon} tone={m.tone} size="lg" />
                <b style={{ fontSize: 14.5, marginTop: 6 }}>{(m.variants as any)[v]?.name || m.name}</b>
                <span className="small muted" style={{ minHeight: 36 }}>{(SUBTEXT[m.key] || m.beskrivning).replace('{central}', central)}</span>
                <span className="small" style={{ fontWeight: 600 }}>{o ? `Utvald av ${central}` : 'Från Bolagsappar'}</span>
                <div className="ba-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 4 }}>
                  <span className="small" style={{ fontWeight: 700 }}>{ingar ? 'Ingår' : prisText(m.key, v)}</span><span className="ba-grow" />
                  {m.status === 'kommer' ? <Pill dot={false}>Kommer snart</Pill> : aktiv ? (ingar ? <Pill tone="info" dot={false}>Ingår via {central || 'avtalet'}</Pill> : <Pill tone="ok">Aktiv</Pill>) : <Button size="sm" variant="dark" onClick={() => setAkt(m)}>Aktivera</Button>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {nya.map(m => (
        <Card key={m.key} className="pf-section">
          <div className="ba-row" style={{ flexWrap: 'nowrap' }}>
            <AppIcon icon={m.icon} tone="blue" size="lg" />
            <div className="ba-grow"><div className="ba-row" style={{ gap: 8 }}><b>{m.name}</b><Pill tone="info" dot={false}>Ny</Pill></div><span className="small muted">{m.beskrivning} Exempel på nästa modul. Signeras med pennan, debiteras från nästa månad, syns direkt i menyn och i appen.</span></div>
            {has(m.key) ? <Pill tone="ok">Aktiv</Pill> : <Button variant="primary" icon="plus" onClick={() => setAkt(m)}>Aktivera för {prisText(m.key, variantFor(m, a.tenant.type))}</Button>}
          </div>
        </Card>
      ))}
      {!kort.length && !nya.length && <EmptyState icon="grid" title="Inga appar här">Byt flik för att se fler.</EmptyState>}
      {akt && <Aktivera m={akt} onClose={() => setAkt(null)} />}
    </>
  );
}

function Aktivera({ m, onClose }: { m: any; onClose: () => void }) {
  const a = useAccount(); const b = useBackend(); const toast = useToast(); const qc = useQueryClient();
  const [sig, setSig] = useState<SignatureHandle | null>(null);
  const [namn, setNamn] = useState('');
  const [busy, setBusy] = useState(false);
  const forsta = ymAdd(new Date().toISOString().slice(0, 7), 1) + '-01';
  const go = async () => {
    if (!sig?.isDirty() || !namn.trim()) { toast('Skriv under med pennan och fyll i namnförtydligande.', { tone: 'bad' }); return; }
    setBusy(true);
    try {
      await b.setLicense(a.tenant.id, m.key, { status: 'aktiv', paid_by: a.tenant.id, started_at: new Date().toISOString().slice(0, 10) });
      await b.log(a.tenant.id, 'aktivera app', m.key, { namn: namn.trim(), signatur: sig.png().slice(0, 60) + '…', forstaDebitering: forsta });
      qc.invalidateQueries(); toast(`${m.name} är aktiverad. Den syns nu i menyn.`); onClose();
    } catch (e: any) { toast(e.message, { tone: 'bad' }); }
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} title={m.name} labelledBy="akt-h" footer={<><Button onClick={onClose}>Avbryt</Button><Button variant="primary" icon="pencil" loading={busy} onClick={go}>Signera och aktivera</Button></>}>
      <div className="ba-stack">
        <span className="small muted">{m.beskrivning}</span>
        <dl className="pf-kv"><div><dt>Pris</dt><dd>{prisText(m.key, variantFor(m, a.tenant.type), { kort: false })}</dd></div><div><dt>Första debitering</dt><dd>{dagText(forsta)}</dd></div><div><dt>Från</dt><dd>{m.fran || 'Bolagsappar'}</dd></div></dl>
        <SignaturePad label={`Underskrift för ${a.tenant.name}`} handleRef={setSig} />
        <TextField label="Namnförtydligande" value={namn} onChange={e => setNamn(e.target.value)} />
      </div>
    </Modal>
  );
}

export function Kommer() {
  return <EmptyState icon="calendar" title="Körjournal">Körjournal för alla bilar, skapad från körningarna i TaxiCaller. Den här modulen byggs nu och kommer i en senare version.</EmptyState>;
}

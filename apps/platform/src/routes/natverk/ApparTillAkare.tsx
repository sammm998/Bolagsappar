// Appar till åkare (sidan 29). Tre lägen per app: ingår, tillval eller av. Förhandsvisning hos en åkare.
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppIcon, Card, Icon, Pill, Segmented, Select, useToast } from '@bolagsappar/ui';
import { MODULES } from '@bolagsappar/modules';
import { useAccount } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useChildLicenses, useNetwork, useOffers } from '../../lib/q';
import { usePage } from '../../shell/Help';

type Mode = 'ingar' | 'tillval' | 'av';
const SUBNAMN: Record<string, string> = { avrakning: 'Min avräkning', kassan: 'Åkarkassan', forarlista: 'Mina förare', skadeflode: 'Skadeflöde', korjournal: 'Körjournal' };
const TEXT: Record<string, string> = {
  avrakning: 'Åkaren ser sin del av er avräkning, per bil, med PDF och historik.',
  kassan: 'Lön, kassaredovisning, bro och Sturup. Hämtar er avräkning automatiskt.',
  forarlista: 'Åkaren ser sina förare från Förarlista och kan koppla dem till lön.',
  skadeflode: 'Skadeärenden och kontakt med skadereglerare för egna bilar.'
};

export function ApparTillAkare() {
  const a = useAccount(); const b = useBackend(); const toast = useToast(); const qc = useQueryClient();
  const offers = useOffers(a.tenant.id);
  const kids = useChildLicenses(a.tenant.id);
  const net = useNetwork(a.tenant.id);
  usePage({ crumbs: ['Appar till åkare'] }, []);
  const mods = MODULES.filter(m => m.variants.sub && m.key !== 'korjournal');
  const offer = (k: string) => (offers.data || []).find(o => o.module_key === k) || { mode: 'av', paid_by: 'parent' };
  const medlemmar = (net.data || []).filter(x => !x.invited);
  const [vis, setVis] = useState<string>('');
  const visad = medlemmar.find(x => x.tenant_id === vis) || medlemmar[0];
  const setMode = async (k: string, mode: Mode) => {
    try {
      await b.setOffer(a.tenant.id, k, { mode, paid_by: mode === 'ingar' ? 'parent' : 'self', auto_enable: mode === 'ingar' });
      if (mode === 'ingar') for (const x of net.data || []) if (!(kids.data || []).some(l => l.tenant_id === x.tenant_id && l.module_key === k && l.status === 'aktiv')) await b.setLicense(x.tenant_id, k, { status: 'aktiv', paid_by: a.tenant.id, variant: 'sub' });
      qc.invalidateQueries();
      toast(`${SUBNAMN[k]}: ${mode === 'ingar' ? 'ingår för alla åkare' : mode === 'tillval' ? 'tillval, åkaren aktiverar själv' : 'av från nästa månad'}.`);
    } catch (e: any) { toast(e.message, { tone: 'bad' }); }
  };
  const status = (k: string) => {
    const o = offer(k); const aktiv = (kids.data || []).some(l => l.tenant_id === visad?.tenant_id && l.module_key === k && l.status === 'aktiv');
    if (o.mode === 'ingar') return 'ingår';
    if (aktiv) return 'aktiverad';
    if (o.mode === 'tillval') return 'tillval';
    return 'dold';
  };
  return (
    <>
      <div className="pf-head"><div className="ba-grow"><h1 className="pf-h1">Appar till åkare</h1><p className="pf-lead">Välj vilka appar era åkare ska ha. Ingår betyder att {a.tenant.name} betalar. Tillval betyder att åkaren själv aktiverar och betalar.</p></div></div>
      <div className="pf-sidebar-layout pf-sidebar-layout--right">
        <div className="ba-stack">
          {mods.map(m => {
            const o = offer(m.key); const kommer = m.status === 'kommer';
            return (
              <Card key={m.key}>
                <div className="ba-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <AppIcon icon={m.icon} tone={m.tone} size="lg" />
                  <div className="ba-grow" style={{ minWidth: 0 }}>
                    <div className="ba-row" style={{ gap: 8 }}><b style={{ fontSize: 14.5 }}>{SUBNAMN[m.key]}</b>{m.key === 'avrakning' && <Pill tone="ok" dot={false}>Rekommenderas</Pill>}{kommer && <Pill tone="info" dot={false}>Kommer snart</Pill>}</div>
                    <div className="small muted" style={{ margin: '2px 0 6px' }}>{TEXT[m.key]}</div>
                    <div className="small">{kommer ? `Släpps ${m.slapps}` : m.key === 'forarlista' ? 'Ingår i Min avräkning' : <><b>[PRIS]</b> per {m.key === 'kassan' ? 'åkeri' : 'åkare'} och månad, {o.paid_by === 'parent' && o.mode === 'ingar' ? `faktureras ${a.tenant.name}` : 'betalas av åkaren'}</>}</div>
                  </div>
                  <Segmented label={'Läge för ' + SUBNAMN[m.key]} value={o.mode as Mode} onChange={v => (kommer && v !== 'av' ? toast(`${SUBNAMN[m.key]} släpps senare.`) : a.canWrite ? setMode(m.key, v) : toast('Du har bara läsbehörighet.'))} options={[{ value: 'ingar', label: 'Ingår' }, { value: 'tillval', label: 'Tillval' }, { value: 'av', label: 'Av' }]} />
                </div>
              </Card>
            );
          })}
        </div>
        <aside className="ba-stack">
          <Card tone="navy">
            <div className="small" style={{ opacity: .75 }}>Så ser åkaren det</div>
            {medlemmar.length > 1 ? <Select value={visad?.tenant_id} onChange={e => setVis(e.target.value)} aria-label="Välj åkare" style={{ margin: '8px 0', background: 'var(--navy-2)', color: '#fff', borderColor: 'var(--navy-3)' }}>{medlemmar.map(x => <option key={x.tenant_id} value={x.tenant_id}>{x.name}</option>)}</Select> : null}
            <b style={{ display: 'block', fontSize: 16, margin: '4px 0 12px' }}>{visad?.name} har</b>
            <ul className="pf-list-plain" style={{ display: 'grid', gap: 6 }}>
              {mods.map(m => <li key={m.key} className="ba-row" style={{ background: 'var(--navy-2)', borderRadius: 8, padding: '9px 12px', flexWrap: 'nowrap' }}><Icon name={m.icon} size={14} /><span className="ba-grow small">{SUBNAMN[m.key]}</span><span className="small" style={{ opacity: .75 }}>{status(m.key)}</span></li>)}
            </ul>
          </Card>
          <Card tone="subtle"><p className="small" style={{ margin: 0 }}><b>Ändringar gäller från nästa månad.</b> Åkare som redan betalar för ett tillval behåller det månaden ut. Alla åkare får ett mejl när något ändras.</p></Card>
        </aside>
      </div>
    </>
  );
}
export { useMemo };

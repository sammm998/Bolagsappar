// Föraren ser bara sina lönespecar och avtal. Avtalet signeras med pennan (rita med fingret).
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Banner, Button, Card, EmptyState, Pill, useToast } from '@bolagsappar/ui';
import { avHash } from '@bolagsappar/core/kassan';
import { kr2, manadAr } from '@bolagsappar/core/format';
import { useAccount, useSession } from '../../lib/session';
import { useBackend } from '../../lib/backend';
import { useDoc, useDocs } from '../../lib/q';
import { lonespecPdf, avtalPdf } from '../../lib/pdf';
import { download } from '../../lib/files';
import { usePage } from '../../shell/Help';
import { Loading } from '../../shell/Shell';
import { AvtalText, SigneraDialog } from '../kassan/Kassan';

export function Lonespecar() {
  const a = useAccount();
  const docs = useDocs<any>(a.tenant.id, 'kassan', '');
  const settings = useDoc<any>(a.tenant.id, 'kassan', 'settings');
  usePage({ crumbs: ['Lönespecar'] }, []);
  if (docs.isLoading) return <Loading />;
  const id = a.forare_id || '';
  const L = (docs.data || []).filter(d => /^m-\d{4}-\d\d$/.test(d.id) && d.data?.lonekorning?.rader?.[id]).sort((x, y) => y.id.localeCompare(x.id));
  return (
    <>
      <div className="pf-head"><div className="ba-grow"><h1 className="pf-h1">Lönespecar</h1><p className="pf-lead">{settings.data?.forare?.[id]?.namn || 'Förare ' + id} · {a.tenant.name}</p></div></div>
      {!L.length ? <EmptyState icon="file" title="Inga lönespecar än">De kommer hit när åkeriet har godkänt lönen.</EmptyState> : (
        <div className="ba-grid ba-grid--2">
          {L.map(d => {
            const p = d.id.slice(2), x = d.data.lonekorning.rader[id];
            return (
              <Card key={d.id} title={manadAr(p)} headExtra={<Pill tone="ok">Utbetalas {d.data.lonekorning.utb}</Pill>}>
                <dl className="pf-kv"><div><dt>Bruttolön</dt><dd>{kr2(x.brutto)}</dd></div><div><dt>Skatt</dt><dd>{kr2(-x.skatt)}</dd></div>{x.kontant ? <div><dt>Kontanter kvittade</dt><dd>{kr2(-x.kontant)}</dd></div> : null}<div className="tot"><dt>Att utbetala</dt><dd>{kr2(x.netto)}</dd></div></dl>
                <div style={{ marginTop: 12 }}><Button size="sm" icon="download" onClick={() => download(`Lonespec_${p}.pdf`, lonespecPdf({ L: { ...x, ag: x.ag }, namn: settings.data?.forare?.[id]?.namn || '', id, foretag: settings.data?.foretag || a.tenant.name, period: p, utb: d.data.lonekorning.utb }))}>Ladda ner PDF</Button></div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

export function Avtal() {
  const a = useAccount(); const b = useBackend(); const toast = useToast(); const qc = useQueryClient(); const { user } = useSession();
  const id = a.forare_id || '';
  const doc = useDoc<any>(a.tenant.id, 'kassan', 'avtal-' + id);
  const settings = useDoc<any>(a.tenant.id, 'kassan', 'settings');
  const [sign, setSign] = useState(false);
  usePage({ crumbs: ['Avtal'] }, []);
  if (doc.isLoading) return <Loading />;
  const v = doc.data?.versioner?.[doc.data.versioner.length - 1];
  if (!v) return <EmptyState icon="pencil" title="Inget avtal än">När åkeriet upprättar ditt anställningsavtal kan du läsa och signera det här, med pennan.</EmptyState>;
  const klart = v.sign?.anst && v.sign?.arbg;
  const namn = settings.data?.forare?.[id]?.namn || user?.name || '';
  return (
    <>
      <div className="pf-head"><div className="ba-grow"><div className="pf-eyebrow">Anställningsavtal</div><h1 className="pf-h1">{namn}</h1><p className="pf-lead">{settings.data?.foretag || a.tenant.name} · upprättat {String(v.skapad).slice(0, 10)}</p></div>
        {klart ? <Button icon="download" onClick={() => download('Anstallningsavtal.pdf', avtalPdf({ v, namn, foretag: settings.data?.foretag || a.tenant.name, orgnr: settings.data?.bolag?.orgnr, rubrik: 'Anställningsavtal' }))}>Signerat avtal (PDF)</Button>
          : !v.sign?.anst && <Button variant="primary" icon="pencil" onClick={() => setSign(true)}>Signera med pennan</Button>}
      </div>
      {!v.sign?.anst && <div style={{ marginBottom: 14 }}><Banner tone="info">Läs avtalet och signera genom att rita din underskrift med fingret. Sedan signerar arbetsgivaren.</Banner></div>}
      {v.sign?.anst && !klart && <div style={{ marginBottom: 14 }}><Banner tone="info">Du har signerat. Väntar på arbetsgivaren.</Banner></div>}
      <Card><AvtalText text={v.text} /></Card>
      {sign && <SigneraDialog role="anst" v={v} namn={namn} titel="Arbetstagarens underskrift" onClose={() => setSign(false)} onDone={async nv => {
        if (await avHash(v.text) !== v.hash) throw new Error('Avtalstexten har ändrats, signering avbruten');
        await b.signAgreement(a.tenant.id, 'avtal-' + id, nv.sign.anst); qc.invalidateQueries({ queryKey: ['documents'] }); toast('Tack. Du har signerat avtalet.'); setSign(false);
      }} />}
    </>
  );
}

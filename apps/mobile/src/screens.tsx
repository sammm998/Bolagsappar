// Skärmarna i mobilappen (sidan 44): Hem, Appar, Ladda upp, Konto. Föraren ser bara lönespec och avtal.
// All beräkning sker i packages/core. Skärmarna visar och sparar.
import { useMemo, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { variantFor } from '@bolagsappar/modules';
import { guideFor } from '@bolagsappar/guides';
import { recognizeKassan, ingestLdl, ldlTillManad, avHash } from '@bolagsappar/core/kassan';
import { FILKATALOG } from '@bolagsappar/core/filetypes';
import { kr2, manadAr, Manad, fornamn, initialer } from './lib/format';
import { useApp, useAcc, useLoad, type Acc } from './lib/ctx';
import { myApps, MODULES } from './lib/apps';
import { C } from './lib/theme';
import { Avatar, Btn, Card, Empty, Field, Loading, Pill, Row, Screen, T, Tile } from './ui';
import { Signatur, type SigHandle } from './Signatur';

export type Go = (name: string, params?: any) => void;
const today = () => new Date();
const veckodag = () => today().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase());
const ymAdd = (p: string, n: number) => { const d = new Date(+p.slice(0, 4), +p.slice(5, 7) - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

// ------------------------------------------------ hem
export function Hem({ go }: { go: Go }) {
  const a = useAcc();
  if (a.role === 'forare') return <HemForare go={go} />;
  return <HemKonto go={go} />;
}

function HemKonto({ go }: { go: Go }) {
  const a = useAcc(); const { user } = useApp(); const t = a.tenant.id;
  const shares = useLoad(b => (a.tenant.type === 'sub' ? b.sharesTo(t, 'avrakning') : Promise.resolve([])), [t]);
  const lic = useLoad(b => b.licenses(t), [t]);
  const offers = useLoad(b => (a.tenant.type === 'sub' ? b.offers(a.tenant.parent_id) : Promise.resolve([])), [t]);
  const latest = shares.data?.[0];
  const kassanM = useLoad(b => (latest ? b.getDoc(t, 'kassan', 'm-' + latest.period) : Promise.resolve(null)), [t, latest?.period]);
  if (lic.loading) return <Loading />;
  const apps = myApps(a.tenant.type, lic.data || []);
  const har = (k: string) => apps.some(x => x.key === k);
  const nya = (offers.data || []).filter((o: any) => o.mode !== 'av' && !har(o.module_key)).length + MODULES.filter((m: any) => m.status === 'ny' && !har(m.key)).length;
  const p = latest?.payload;
  return (
    <Screen title={`Hej ${fornamn(user?.name)}`} sub={veckodag()}>
      {a.tenant.type === 'sub' && (latest ? (
        <Pressable onPress={() => go('avrakning', { period: latest.period })} accessibilityRole="button">
          <Card tone="green">
            <T small color="rgba(255,255,255,.8)">Från {p.fran}</T>
            <T bold color="#fff" style={{ fontSize: 18, marginTop: 2 }}>{Manad(latest.period)} är klar</T>
            <T mono bold color="#fff" style={{ fontSize: 28, marginTop: 8 }}>{kr2(p.belopp)} kr</T>
            <T small color="rgba(255,255,255,.8)">{p.riktning === 'betalar' ? 'att betala till centralen' : `utbetalas ${p.utbetalas || ''}`}</T>
          </Card>
        </Pressable>
      ) : <Empty title="Ingen avräkning än">Du får en notis när {a.parent?.name || 'centralen'} publicerar.</Empty>)}
      <T bold style={{ marginTop: 6 }}>Mina appar</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {apps.map(x => {
          const sub = x.key === 'avrakning' && latest ? `${Manad(latest.period)} klar` : x.key === 'kassan' && latest ? (kassanM.data?.ldl ? 'LDL inläst' : 'LDL saknas') : x.beskrivning?.split('.')[0];
          return <Tile key={x.key} title={x.namn} sub={sub} tone={x.tone} badge={x.key === 'kassan' && latest && !kassanM.data?.ldl ? '!' : undefined} onPress={() => go(x.key === 'avrakning' && latest ? 'avrakning' : x.key === 'kassan' ? 'ladda' : 'app', { period: latest?.period, key: x.key })} />;
        })}
        <Tile title="Appbutik" sub={nya ? `${nya} nya` : 'Fler appar'} tone="#E8EEF8" onPress={() => go('appar')} />
      </View>
      {a.tenant.type === 'main' && <Card><T muted small>Avräkningen räknas och publiceras på datorn. Här ser du läget och notiserna.</T></Card>}
    </Screen>
  );
}

export function Avrakning({ period }: { period: string }) {
  const a = useAcc(); const t = a.tenant.id;
  const shares = useLoad(b => b.sharesTo(t, 'avrakning'), [t]);
  if (shares.loading) return <Loading />;
  const L = (shares.data || []).filter((s: any) => s.period === period).sort((x: any, y: any) => y.version - x.version);
  const s = L[0]; const p = s?.payload;
  if (!s) return <Screen><Empty title="Avräkningen finns inte" /></Screen>;
  return (
    <Screen title={`Min avräkning ${Manad(period).toLowerCase()}`} sub={`Från ${p.fran}${s.version > 1 ? ` · version ${s.version}, rättad: ${s.reason || ''}` : ''}`}>
      <Card>
        {(p.sammanfattning || []).map((r: any) => <Row key={r.key} label={r.text} value={kr2(r.belopp)} />)}
        <Row bold last label={p.riktning === 'betalar' ? 'Att betala' : 'Att få'} value={kr2(p.belopp) + ' kr'} />
      </Card>
      {(p.perBil || []).length > 0 && <Card title="Per bil">{p.perBil.map((x: any, i: number) => <Row key={x.bil} last={i === p.perBil.length - 1} label={`Bil ${x.bil} · ${x.reg}`} value={kr2(x.netto ?? x.att ?? 0)} />)}</Card>}
      <T muted small>PDF och historik finns på datorn under Min avräkning.</T>
    </Screen>
  );
}

// ------------------------------------------------ föraren
function useForare() {
  const a = useAcc(); const t = a.tenant.id; const id = a.forare_id || '';
  const docs = useLoad(b => b.listDocs(t, 'kassan', ''), [t]);
  const avtal = useLoad(b => b.getDoc(t, 'kassan', 'avtal-' + id), [t, id]);
  const settings = useLoad(b => b.getDoc(t, 'kassan', 'settings').catch(() => null), [t]);
  const specar = (docs.data || []).filter((d: any) => /^m-\d{4}-\d\d$/.test(d.id) && d.data?.lonekorning?.rader?.[id]).sort((x: any, y: any) => y.id.localeCompare(x.id)).map((d: any) => ({ period: d.id.slice(2), x: d.data.lonekorning.rader[id], utb: d.data.lonekorning.utb }));
  const v = avtal.data?.versioner?.[avtal.data.versioner.length - 1] || null;
  return { id, specar, v, loading: docs.loading || avtal.loading, namn: settings.data?.forare?.[id]?.namn };
}

function HemForare({ go }: { go: Go }) {
  const a = useAcc(); const { user } = useApp(); const F = useForare();
  if (F.loading) return <Loading />;
  const s = F.specar[0];
  return (
    <Screen title={`Hej ${fornamn(user?.name)}`} sub={`Förare ${F.id} · ${a.tenant.name}`}>
      {s ? <Pressable onPress={() => go('lonespec', { period: s.period })} accessibilityRole="button"><Card title={`Lönespec ${Manad(s.period).toLowerCase()}`}>
        <Row label="Bruttolön" value={kr2(s.x.brutto)} />
        <Row label="Skatt" value={kr2(-s.x.skatt)} />
        {s.x.kontant ? <Row label="Kontanter kvittade" value={kr2(-s.x.kontant)} /> : null}
        <Row bold last label="Att utbetala" value={kr2(s.x.netto)} />
        <T muted small style={{ marginTop: 6 }}>Utbetalas {s.utb}</T>
      </Card></Pressable> : <Empty title="Ingen lönespec än">Den kommer hit när åkeriet har godkänt lönen.</Empty>}
      {F.v && !F.v.sign?.anst && <Card tone="navy"><T bold color="#fff">Anställningsavtal</T><T small color="rgba(255,255,255,.8)" style={{ marginVertical: 6 }}>Väntar på din signatur.</T><Btn onPress={() => go('avtal')}>Signera</Btn></Card>}
      {F.v?.sign?.anst && <Card><T bold>Anställningsavtal</T><T muted small>{F.v.sign.arbg ? 'Signerat av båda.' : 'Du har signerat. Väntar på arbetsgivaren.'}</T></Card>}
      {F.specar.length > 1 && <Card title="Tidigare lönespecar">{F.specar.slice(1).map((x: any, i: number, L: any[]) => <Pressable key={x.period} onPress={() => go('lonespec', { period: x.period })}><Row last={i === L.length - 1} label={manadAr(x.period)} value={kr2(x.x.netto)} /></Pressable>)}</Card>}
    </Screen>
  );
}

export function Lonespec({ period }: { period: string }) {
  const a = useAcc(); const F = useForare();
  if (F.loading) return <Loading />;
  const s = F.specar.find((x: any) => x.period === period);
  if (!s) return <Screen><Empty title="Lönespecen finns inte" /></Screen>;
  const x = s.x;
  return (
    <Screen title={`Lönespec ${Manad(period).toLowerCase()}`} sub={`${F.namn || 'Förare ' + F.id} · ${a.tenant.name}`}>
      <Card>
        <Row label="Bruttolön" value={kr2(x.brutto)} />
        {x.semersattning ? <Row label="Semesterersättning" value={kr2(x.semersattning)} /> : null}
        <Row label="Skatt" value={kr2(-x.skatt)} />
        {x.kontant ? <Row label="Kontanter kvittade" value={kr2(-x.kontant)} /> : null}
        {x.avdrag ? <Row label="Avdrag" value={kr2(-x.avdrag)} /> : null}
        <Row bold last label="Att utbetala" value={kr2(x.netto)} />
      </Card>
      <T muted small>Utbetalas {s.utb}. PDF finns på datorn under Lönespecar.</T>
    </Screen>
  );
}

export function Avtal({ back }: { back: () => void }) {
  const a = useAcc(); const { b, user } = useApp(); const F = useForare();
  const [sig, setSig] = useState<SigHandle | null>(null);
  const [namn, setNamn] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  if (F.loading) return <Loading />;
  const v = F.v;
  if (!v) return <Screen><Empty title="Inget avtal än">När åkeriet upprättar ditt anställningsavtal kan du läsa och signera det här.</Empty></Screen>;
  const signera = async () => {
    if (!ok) { Alert.alert('Bekräfta', 'Bekräfta att du har läst avtalet.'); return; }
    if (!sig?.isDirty() || !(namn || F.namn || user?.name || '').trim()) { Alert.alert('Underskrift saknas', 'Rita din underskrift och fyll i namnförtydligande.'); return; }
    setBusy(true);
    try {
      if (await avHash(v.text) !== v.hash) throw new Error('Avtalstexten har ändrats, signering avbruten');
      await b.signAgreement(a.tenant.id, 'avtal-' + F.id, { namn: (namn || F.namn || user?.name).trim(), ort: '', png: sig.png(), ua: 'Bolagsappar mobil' });
      Alert.alert('Tack', 'Du har signerat avtalet. Nu signerar arbetsgivaren.'); back();
    } catch (e: any) { Alert.alert('Det gick inte', e.message); }
    setBusy(false);
  };
  return (
    <Screen title="Anställningsavtal" sub={a.tenant.name}>
      <Card>{(Array.isArray(v.text) ? v.text : []).map((x: any, i: number) => <View key={i} style={{ marginBottom: 10 }}><T bold small>{i + 1}. {x.h}</T>{(x.p || []).map((p: string, j: number) => <T key={j} small>{p}</T>)}</View>)}</Card>
      {v.sign?.anst ? <Card><T bold>Du har signerat</T><T muted small>{String(v.sign.anst.tid).slice(0, 10)}</T></Card> : (
        <Card>
          <Signatur label="Arbetstagarens underskrift" onReady={setSig} />
          <Field label="Namnförtydligande" value={namn} onChangeText={setNamn} placeholder={F.namn || user?.name || ''} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 }}><Switch value={ok} onValueChange={setOk} accessibilityLabel="Jag har läst avtalet och godkänner villkoren" /><T small style={{ flex: 1 }}>Jag har läst avtalet och godkänner villkoren.</T></View>
          <Btn onPress={signera} disabled={busy}>{busy ? 'Signerar...' : 'Signera med pennan'}</Btn>
        </Card>
      )}
    </Screen>
  );
}

// ------------------------------------------------ appar och appbutik
export function Appar({ go }: { go: Go }) {
  const a = useAcc(); const t = a.tenant.id;
  const lic = useLoad(b => b.licenses(t), [t]);
  const offers = useLoad(b => (a.tenant.type === 'sub' ? b.offers(a.tenant.parent_id) : Promise.resolve([])), [t]);
  if (lic.loading) return <Loading />;
  const has = (k: string) => (lic.data || []).find((l: any) => l.module_key === k && l.status === 'aktiv');
  const offer = (k: string) => (offers.data || []).find((o: any) => o.module_key === k);
  const mods = MODULES.filter((m: any) => {
    const v = variantFor(m, a.tenant.type);
    if (!m.variants[v] || (m.variants[v].erbjuds && a.tenant.type !== 'main')) return false;
    if (a.tenant.type === 'sub') return offer(m.key)?.mode !== 'av' || has(m.key) || m.status === 'kommer';
    return true;
  });
  const central = a.parent?.name || '';
  return (
    <Screen title="Appar" sub={a.tenant.type === 'sub' ? `Appar som ${central} har valt, och appar från Bolagsappar.` : 'Appar från Bolagsappar.'}>
      {mods.map((m: any) => {
        const o = offer(m.key), aktiv = has(m.key), ingar = o?.mode === 'ingar' || (aktiv && aktiv.paid_by && aktiv.paid_by !== t);
        const v = variantFor(m, a.tenant.type);
        return (
          <Card key={m.key}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><T bold>{m.variants[v]?.name || m.name}</T>{m.status === 'ny' && <Pill tone="info">Ny</Pill>}</View>
            <T muted small style={{ marginTop: 2 }}>{m.variants[v]?.beskrivning || m.beskrivning}</T>
            <T small bold style={{ marginTop: 6 }}>{o ? `Från ${central}` : 'Från Bolagsappar'} · {ingar ? 'Ingår' : '[PRIS] kr per månad'}</T>
            <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
              {m.status === 'kommer' ? <Pill>Kommer snart</Pill> : aktiv ? <Pill tone={ingar ? 'info' : 'ok'}>{ingar ? `Ingår via ${central || 'avtalet'}` : 'Aktiv'}</Pill> : <Btn small kind="dark" onPress={() => go('aktivera', { key: m.key })}>Aktivera</Btn>}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

export function Aktivera({ k, back }: { k: string; back: () => void }) {
  const a = useAcc(); const { b } = useApp();
  const m: any = MODULES.find((x: any) => x.key === k);
  const [sig, setSig] = useState<SigHandle | null>(null);
  const [namn, setNamn] = useState('');
  const [busy, setBusy] = useState(false);
  const forsta = ymAdd(today().toISOString().slice(0, 7), 1) + '-01';
  const go = async () => {
    if (!sig?.isDirty() || !namn.trim()) { Alert.alert('Underskrift saknas', 'Skriv under med pennan och fyll i namnförtydligande.'); return; }
    setBusy(true);
    try {
      await b.setLicense(a.tenant.id, k, { status: 'aktiv', paid_by: a.tenant.id, started_at: today().toISOString().slice(0, 10) });
      await b.log(a.tenant.id, 'aktivera app', k, { namn: namn.trim(), signatur: sig.png().slice(0, 60) + '…', forstaDebitering: forsta });
      Alert.alert('Klart', `${m.name} är aktiverad.`); back();
    } catch (e: any) { Alert.alert('Det gick inte', e.code === 'not_granted' ? 'Bara ägaren kan aktivera appar.' : e.message); }
    setBusy(false);
  };
  return (
    <Screen title={m.name} sub={m.beskrivning}>
      <Card>
        <Row label="Pris" value="[PRIS] kr per månad" />
        <Row last label="Första debitering" value={forsta} />
      </Card>
      <Card>
        <Signatur label="Underskrift" onReady={setSig} />
        <Field label="Namnförtydligande" value={namn} onChangeText={setNamn} />
        <View style={{ height: 12 }} />
        <Btn onPress={go} disabled={busy}>{busy ? 'Aktiverar...' : 'Aktivera och signera med pennan'}</Btn>
      </Card>
    </Screen>
  );
}

// ------------------------------------------------ ladda upp
export function LaddaUpp() {
  const a = useAcc(); const { b } = useApp(); const t = a.tenant.id;
  const lic = useLoad(bb => bb.licenses(t), [t]);
  const shares = useLoad(bb => (a.tenant.type === 'sub' ? bb.sharesTo(t, 'avrakning') : Promise.resolve([])), [t]);
  const period = shares.data?.[0]?.period;
  const month = useLoad(bb => (period ? bb.getDoc(t, 'kassan', 'm-' + period) : Promise.resolve(null)), [t, period]);
  const settings = useLoad(bb => bb.getDoc(t, 'kassan', 'settings').catch(() => null), [t]);
  const [visa, setVisa] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const harKassan = (lic.data || []).some((l: any) => l.module_key === 'kassan' && l.status === 'aktiv');
  const guide = useMemo(() => FILKATALOG.find((f: any) => f.key === 'ldl'), []);
  if (lic.loading || shares.loading) return <Loading />;
  if (a.role === 'forare') return <Screen title="Ladda upp"><Empty title="Inget att ladda upp">Som förare får du lönespec och avtal. Åkeriet laddar upp filerna.</Empty></Screen>;
  if (!harKassan) return <Screen title="Ladda upp"><Empty title="Inget att ladda upp här">Filer laddas upp i apparna på datorn. Aktivera Åkarkassan för att ladda upp LDL från telefonen.</Empty></Screen>;
  const valj = async () => {
    setMsg(null);
    const r = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'text/csv', '*/*'], copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.[0]) return;
    const f = r.assets[0];
    try {
      const text = await (await fetch(f.uri)).text();
      const rec = recognizeKassan({ name: f.name, kind: 'text', text }, []);
      if (rec.type !== 'ldl') { setMsg({ ok: false, text: 'Det här ser inte ut som en LDL-fil från Megtax. Välj löneunderlaget.' }); return; }
      const s = settings.data || { foretag: a.tenant.name, cfg: {}, forare: {}, bilar: {} };
      const ing = ingestLdl(rec.text, s);
      if (ing.error) { setMsg({ ok: false, text: ing.error }); return; }
      if (ing.period !== period) { setMsg({ ok: false, text: `Filen gäller ${manadAr(ing.period)}, men månaden som väntar är ${manadAr(period!)}.` }); return; }
      const x = ldlTillManad({ text: rec.text, name: f.name, r: ing, settings: s, month: month.data || { forare: {}, overrides: {}, files: {} } });
      await b.setDoc(t, 'kassan', 'settings', x.settings);
      await b.setDoc(t, 'kassan', 'm-' + period, x.month);
      setMsg({ ok: true, text: x.msg });
    } catch (e: any) { setMsg({ ok: false, text: `Kunde inte läsa ${f.name}: ${e.message}` }); }
  };
  const har = !!month.data?.ldl;
  return (
    <Screen title="Ladda upp" sub={period ? `Åkarkassan · ${manadAr(period)}` : 'Åkarkassan'}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><T bold>LDL från Megtax</T><Pill tone={har ? 'ok' : 'warn'}>{har ? 'Inläst' : 'Saknas'}</Pill></View>
        <T muted small style={{ marginVertical: 8 }}>Välj fil från telefonen, eller dela den från Megtax eller mejlen.</T>
        <Btn onPress={valj} disabled={!period}>Välj fil</Btn>
        {msg && <View style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: msg.ok ? C.okBg : C.badBg }}><T small color={msg.ok ? C.ok : C.bad}>{msg.text}</T></View>}
      </Card>
      <Card><T bold>Från {a.parent?.name || 'centralen'}</T><T muted small>Avräkning, bro och Sturup kommer automatiskt.</T></Card>
      <Pressable onPress={() => setVisa(!visa)} accessibilityRole="button"><Card>
        <T bold>Var hittar jag LDL-filen?</T>
        {!visa ? <T muted small>{(guide?.hjalp?.steg || []).length} steg i Megtax. Tryck för att visa.</T> : <View style={{ marginTop: 6, gap: 4 }}>{(guide?.hjalp?.steg || []).map((r: string, i: number) => <T key={i} small>{i + 1}. {r}</T>)}{guide?.hjalp?.nar ? <T muted small>När: {guide.hjalp.nar}</T> : null}</View>}
      </Card></Pressable>
    </Screen>
  );
}

// ------------------------------------------------ konto
export function Konto() {
  const { accounts, acc, setAcc, b, demo } = useApp();
  const [notis, setNotis] = useState(true);
  const a = acc!;
  const g = guideFor('avrakning', a.tenant.type === 'main' ? 'main' : 'sub', { central: a.parent?.name || 'centralen' });
  return (
    <Screen title="Konto">
      <Card title="Mina bolag">
        {accounts.filter((x: Acc) => x.tenant.type !== 'platform').map((x: Acc, i: number, L: Acc[]) => (
          <Pressable key={x.tenant.id + x.role} onPress={() => setAcc(x)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: i === L.length - 1 ? 0 : 1, borderBottomColor: C.line }}>
            <Avatar text={x.tenant.brand?.initialer || initialer(x.tenant.name)} bg={x.tenant.brand?.accent} fg={x.tenant.brand?.text} />
            <View style={{ flex: 1 }}><T bold>{x.tenant.name}</T><T muted small>{x.role === 'forare' ? 'Förare' : x.tenant.type === 'sub' ? `Åkare hos ${x.parent?.name || ''}` : x.tenant.type === 'main' ? 'Huvudkund' : 'Direktkund'}</T></View>
            {x.tenant.id === a.tenant.id && x.role === a.role && <Pill tone="ok">Valt</Pill>}
          </Pressable>
        ))}
      </Card>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flex: 1 }}><T bold>Notiser</T><T muted small>När en ny månad är klar eller något väntar på dig.</T></View><Switch value={notis} onValueChange={setNotis} accessibilityLabel="Notiser" /></View>
      </Card>
      {g && a.role !== 'forare' && <Card title="Så funkar det">{g.welcome.map((w: any, i: number) => <T key={i} small style={{ marginBottom: 6 }}>{i + 1}. {w.body}</T>)}</Card>}
      <Card><T muted small>Inloggning med e-postlänk. Avtal och appar signeras med pennan.{demo ? ' Demoläge: påhittad data, inget sparas.' : ''}</T></Card>
      <Btn kind="secondary" onPress={() => b.signOut()}>Logga ut</Btn>
    </Screen>
  );
}

export function AppInfo({ k }: { k: string }) {
  const m: any = MODULES.find((x: any) => x.key === k);
  return <Screen title={m?.name || ''}><Card><T>{m?.beskrivning}</T><T muted small style={{ marginTop: 8 }}>Hela appen finns på datorn. I mobilen ser du läget och laddar upp filer.</T></Card></Screen>;
}

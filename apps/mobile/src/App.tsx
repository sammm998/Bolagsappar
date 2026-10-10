// Mobilappen: samma app i App Store för alla kunder. Kontot och rollen avgör vad som syns.
// Inloggning med e-postlänk (ingen BankID). Utan Supabase-nycklar körs ett demoläge med påhittad data i minnet.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { createLocalBackend, createSupabaseBackend, DEMO_LOGINS } from '@bolagsappar/api';
import { seedDemo } from '@bolagsappar/api/demo';
import { AppCtx, useApp as useAppCtx, type Acc } from './lib/ctx';
import { C } from './lib/theme';
import { initialer } from './lib/format';
import { Avatar, Btn, Card, Field, Loading, Screen, T } from './ui';
import { Hem, Appar, LaddaUpp, Konto, Avrakning, Lonespec, Avtal, Aktivera, AppInfo } from './screens';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL, KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function makeBackend() {
  if (URL && KEY) return { b: createSupabaseBackend({ url: URL, anonKey: KEY, redirectTo: 'bolagsappar://' }), demo: false };
  const b = createLocalBackend({ storage: null });
  await seedDemo(b);
  return { b, demo: true };
}

export default function App() {
  const [B, setB] = useState<{ b: any; demo: boolean } | null>(null);
  const [user, setUser] = useState<any>(null);
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [acc, setAcc] = useState<Acc | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { makeBackend().then(setB); }, []);
  const refresh = useCallback(async () => {
    if (!B) return;
    const u = await B.b.getUser(); setUser(u);
    const L: Acc[] = u ? (await B.b.myAccounts()).filter((x: Acc) => x.tenant.type !== 'platform') : [];
    setAccounts(L); setAcc(cur => (cur && L.find(x => x.tenant.id === cur.tenant.id && x.role === cur.role)) || L.find(x => x.role === 'forare') || L.find(x => x.tenant.type === 'sub') || L[0] || null);
    setReady(true);
  }, [B]);
  useEffect(() => { if (!B) return; refresh(); return B.b.onAuthChange(() => refresh()); }, [B, refresh]);
  const ctx = useMemo(() => (B ? { b: B.b, demo: B.demo, user, accounts, acc, setAcc, refresh } : null), [B, user, accounts, acc, refresh]);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: C.subtle }} edges={['top']}>
        {!ctx || !ready ? <Loading /> : <AppCtx.Provider value={ctx}>{!user ? <Login /> : !acc ? <IngetKonto /> : <Main key={acc.tenant.id + acc.role} />}</AppCtx.Provider>}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Login() {
  const { b, demo } = useAppCtx();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const send = async () => {
    setErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr('Fyll i din e-postadress.'); return; }
    try { await b.signInWithEmail(email.trim()); setSent(true); } catch (e: any) { setErr(e.message); }
  };
  return (
    <Screen>
      <View style={{ alignItems: 'flex-start', gap: 6, marginTop: 24, marginBottom: 8 }}>
        <Avatar text="BA" size={44} />
        <Text style={{ fontSize: 30, fontWeight: '700', color: C.text, marginTop: 12, letterSpacing: -0.5 }}>Logga in</Text>
        <T muted>Vi skickar en inloggningslänk till din e-post. Inget lösenord, ingen BankID.</T>
      </View>
      {sent ? <Card><T bold>Kolla din e-post</T><T muted small>Tryck på länken i mejlet till {email} på den här telefonen.</T></Card> : (
        <Card>
          <Field label="E-post" value={email} onChangeText={setEmail} placeholder="namn@foretag.se" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          {err ? <T small color={C.bad} style={{ marginTop: 8 }}>{err}</T> : null}
          <View style={{ height: 12 }} />
          <Btn onPress={send}>Skicka inloggningslänk</Btn>
        </Card>
      )}
      {demo && (
        <Card title="Demoläge">
          <T muted small style={{ marginBottom: 8 }}>Påhittad data. Välj en roll.</T>
          {DEMO_LOGINS.filter((d: any) => !/superadmin/.test(d.roll)).map((d: any) => (
            <Pressable key={d.user} onPress={() => b.signInAsDemo(d.user)} accessibilityRole="button" style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}>
              <T bold>{d.roll}</T><T muted small>{d.hint}</T>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function IngetKonto() {
  const { b } = useAppCtx();
  return <Screen title="Inget bolag än"><Card><T>Du är inloggad men hör inte till något bolag ännu. Öppna inbjudan från mejlet, eller be ditt bolag bjuda in dig.</T></Card><Btn kind="secondary" onPress={() => b.signOut()}>Logga ut</Btn></Screen>;
}

const TABS = [['hem', 'Hem'], ['appar', 'Appar'], ['ladda', 'Ladda upp'], ['konto', 'Konto']] as const;
type Route = { name: string; params?: any };

function Main() {
  const { acc } = useAppCtx();
  const [tab, setTab] = useState<string>('hem');
  const [stack, setStack] = useState<Route[]>([]);
  const go = (name: string, params?: any) => { if (TABS.some(t => t[0] === name)) { setTab(name); setStack([]); } else setStack(s => [...s, { name, params }]); };
  const back = () => setStack(s => s.slice(0, -1));
  const top = stack[stack.length - 1];
  const a = acc!;
  const tabs: (readonly [string, string])[] = a.role === 'forare' ? TABS.filter(t => t[0] === 'hem' || t[0] === 'konto') : [...TABS];
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.line }}>
        {top ? <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Tillbaka" hitSlop={12}><Text style={{ fontSize: 16, color: C.green, fontWeight: '600' }}>Tillbaka</Text></Pressable>
          : <><Avatar size={30} text={a.tenant.brand?.initialer || initialer(a.tenant.name)} bg={a.tenant.brand?.accent} fg={a.tenant.brand?.text} /><Text style={{ fontWeight: '700', color: C.text, fontSize: 15, flex: 1 }} numberOfLines={1}>{a.tenant.name}</Text></>}
      </View>
      <View style={{ flex: 1 }}>
        {top ? <Stack r={top} back={back} /> : tab === 'hem' ? <Hem go={go} /> : tab === 'appar' ? <Appar go={go} /> : tab === 'ladda' ? <LaddaUpp /> : <Konto />}
      </View>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingBottom: Platform.OS === 'ios' ? 20 : 8, paddingTop: 8 }}>
        {tabs.map(([k, l]) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k && !top }} onPress={() => go(k)} style={{ flex: 1, alignItems: 'center', gap: 4, minHeight: 44, justifyContent: 'center' }}>
            <View style={{ width: 22, height: 4, borderRadius: 2, backgroundColor: tab === k ? C.green : 'transparent' }} />
            <Text style={{ fontSize: 12.5, fontWeight: tab === k ? '700' : '500', color: tab === k ? C.green : C.muted }}>{l}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Stack({ r, back }: { r: Route; back: () => void }) {
  if (r.name === 'avrakning') return <Avrakning period={r.params.period} />;
  if (r.name === 'lonespec') return <Lonespec period={r.params.period} />;
  if (r.name === 'avtal') return <Avtal back={back} />;
  if (r.name === 'aktivera') return <Aktivera k={r.params.key} back={back} />;
  return <AppInfo k={r.params?.key} />;
}


// Mobilens komponenter. Samma ton som plattformen: vit yta, marinblå text, grön knapp.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { C, F } from './lib/theme';

export function Screen({ children, title, sub }: { children: ReactNode; title?: string; sub?: string }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.subtle }} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
      {title ? <View style={{ marginBottom: 2 }}><Text style={s.h1} accessibilityRole="header">{title}</Text>{sub ? <Text style={s.sub}>{sub}</Text> : null}</View> : null}
      {children}
    </ScrollView>
  );
}
export function Card({ children, title, style, tone }: { children: ReactNode; title?: string; style?: ViewStyle; tone?: 'green' | 'navy' }) {
  const bg = tone === 'green' ? C.green : tone === 'navy' ? C.navy : C.white;
  return <View style={[s.card, { backgroundColor: bg, borderColor: tone ? bg : C.line }, style]}>{title ? <Text style={[s.cardTitle, tone && { color: '#fff' }]}>{title}</Text> : null}{children}</View>;
}
export function T({ children, muted, small, bold, mono, color, style }: { children: ReactNode; muted?: boolean; small?: boolean; bold?: boolean; mono?: boolean; color?: string; style?: any }) {
  return <Text style={[{ color: color || (muted ? C.muted : C.text), fontSize: small ? 13 : 15, lineHeight: small ? 18 : 21 }, bold && { fontWeight: '700' }, mono && { fontFamily: F.mono }, style]}>{children}</Text>;
}
export function Btn({ children, onPress, kind = 'primary', disabled, small }: { children: ReactNode; onPress: () => void; kind?: 'primary' | 'secondary' | 'link' | 'dark'; disabled?: boolean; small?: boolean }) {
  const bg = kind === 'primary' ? C.green : kind === 'dark' ? C.navy : kind === 'secondary' ? C.white : 'transparent';
  const fg = kind === 'primary' || kind === 'dark' ? '#fff' : kind === 'link' ? C.green : C.text;
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.btn, small && { minHeight: 38, paddingHorizontal: 14 }, { backgroundColor: bg, borderColor: kind === 'secondary' ? C.line : bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}>
      <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 14 : 16 }}>{children}</Text>
    </Pressable>
  );
}
export function Pill({ children, tone = 'draft' }: { children: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'info' | 'draft' }) {
  const m = { ok: [C.okBg, C.ok], warn: [C.warnBg, C.warn], bad: [C.badBg, C.bad], info: [C.infoBg, C.info], draft: ['#EEF0F3', '#5B6475'] }[tone];
  return <View style={[s.pill, { backgroundColor: m[0] }]}><Text style={{ color: m[1], fontSize: 12, fontWeight: '600' }}>{children}</Text></View>;
}
export function Row({ label, value, bold, last }: { label: ReactNode; value: ReactNode; bold?: boolean; last?: boolean }) {
  return <View style={[s.row, last && { borderBottomWidth: 0 }]}><Text style={[{ color: C.text, fontSize: 14, flex: 1 }, bold && { fontWeight: '700' }]}>{label}</Text><Text style={[{ color: C.text, fontSize: 14, fontFamily: F.mono }, bold && { fontWeight: '700' }]}>{value}</Text></View>;
}
export function Field(props: TextInputProps & { label: string }) {
  return <View style={{ gap: 6 }}><Text style={{ fontWeight: '600', fontSize: 14, color: C.text }}>{props.label}</Text><TextInput placeholderTextColor={C.muted} {...props} style={[s.input, props.style]} accessibilityLabel={props.label} /></View>;
}
export function Loading() { return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}><ActivityIndicator color={C.green} /></View>; }
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <Card><T bold>{title}</T>{children ? <T muted small style={{ marginTop: 4 }}>{children}</T> : null}</Card>;
}
export function Avatar({ text, bg = C.navy, fg = '#fff', size = 36 }: { text: string; bg?: string; fg?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: fg, fontWeight: '700', fontSize: size * 0.36 }}>{text}</Text></View>;
}
export function Tile({ title, sub, tone, onPress, badge }: { title: string; sub?: string; tone?: string; onPress?: () => void; badge?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.tile, pressed && { opacity: 0.85 }]}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tone || C.greenSoft, marginBottom: 10 }} />
      <Text style={{ fontWeight: '700', color: C.text, fontSize: 15 }}>{title}</Text>
      {sub ? <Text style={{ color: badge ? C.warn : C.muted, fontSize: 13, marginTop: 2 }}>{sub}</Text> : null}
    </Pressable>
  );
}

export const s = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '700', color: C.text, letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 14, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  cardTitle: { fontWeight: '700', fontSize: 16, color: C.text, marginBottom: 8 },
  btn: { minHeight: 48, borderRadius: 999, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, height: 24, borderRadius: 999, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line, gap: 12 },
  input: { minHeight: 48, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: C.text, backgroundColor: C.white },
  tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14 }
});

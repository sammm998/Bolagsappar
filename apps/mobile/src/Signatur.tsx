// Pennan: föraren ritar sin underskrift med fingret. Dragen blir en PNG i packages/core (ingen canvas i appen).
import { useRef, useState } from 'react';
import { PanResponder, View, Text, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { strokesToPng } from '@bolagsappar/core/signatur';
import { C } from './lib/theme';

export interface SigHandle { isDirty: () => boolean; png: () => string; clear: () => void }

export function Signatur({ label, onReady }: { label: string; onReady: (h: SigHandle) => void }) {
  const [strokes, setStrokes] = useState<number[][][]>([]);
  const cur = useRef<number[][] | null>(null);
  const size = useRef({ w: 300, h: 160 });
  const ref = useRef(strokes); ref.current = strokes;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: e => { cur.current = [[e.nativeEvent.locationX, e.nativeEvent.locationY]]; setStrokes(s => [...s, cur.current!]); },
    onPanResponderMove: e => { if (!cur.current) return; cur.current.push([e.nativeEvent.locationX, e.nativeEvent.locationY]); setStrokes(s => [...s.slice(0, -1), [...cur.current!]]); },
    onPanResponderRelease: () => { cur.current = null; },
    onPanResponderTerminationRequest: () => false
  })).current;
  const handle = useRef<SigHandle>({
    isDirty: () => ref.current.some(s => s.length > 0),
    png: () => strokesToPng(ref.current, size.current.w, size.current.h).png,
    clear: () => setStrokes([])
  });
  const onLayout = (e: LayoutChangeEvent) => { size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; onReady(handle.current); };
  const d = (s: number[][]) => s.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + (s.length === 1 ? ' l0.1 0' : '');
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontWeight: '600', fontSize: 14, color: C.text }}>{label}</Text>
      <View onLayout={onLayout} {...pan.panHandlers} accessibilityLabel={`${label}. Rita din underskrift med fingret.`} style={{ height: 170, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, overflow: 'hidden' }}>
        <Svg width="100%" height="100%" pointerEvents="none">
          {strokes.map((s, i) => <Path key={i} d={d(s)} stroke={C.navy} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
        </Svg>
        {!strokes.length && <Text pointerEvents="none" style={{ position: 'absolute', left: 16, bottom: 14, color: C.muted, fontSize: 13 }}>Rita med fingret</Text>}
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 36, height: 1, backgroundColor: C.line }} />
      </View>
      <Text onPress={() => setStrokes([])} accessibilityRole="button" style={{ color: C.green, fontWeight: '600', fontSize: 14, alignSelf: 'flex-end', padding: 4 }}>Rensa</Text>
    </View>
  );
}

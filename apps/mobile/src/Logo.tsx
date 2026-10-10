// Loggan ur specifikationen, samma geometri som packages/ui.
import Svg, { Path } from 'react-native-svg';
import { LOGO_COLORS, LOGO_H, LOGO_W, SYMBOL, WORDMARK } from '@bolagsappar/ui/brand';

export function Logo({ size = 24, text = true, dark = false }: { size?: number; text?: boolean; dark?: boolean }) {
  const [c, g] = dark ? LOGO_COLORS.dark : LOGO_COLORS.light;
  const w = text ? LOGO_W : LOGO_H;
  return (
    <Svg width={(w / LOGO_H) * size} height={size} viewBox={`0 0 ${w} ${LOGO_H}`} accessibilityLabel="bolagsappar">
      {SYMBOL.map((d, i) => <Path key={i} d={d} fill={i === 3 ? g : c} />)}
      {text ? <Path d={WORDMARK} fill={c} /> : null}
    </Svg>
  );
}

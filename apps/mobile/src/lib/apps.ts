// Mina appar från licenser och manifest (samma regel som plattformens meny).
import { MODULES } from '@bolagsappar/modules';
const TONE: Record<string, string> = { green: '#E7F0EA', amber: '#F6EBD6', blue: '#E8EEF8', red: '#F8E5E0' };
export function myApps(type: string, licenses: any[]) {
  return (licenses || []).filter(l => l.status === 'aktiv').map(l => {
    const m: any = MODULES.find((x: any) => x.key === l.module_key);
    if (!m) return null;
    const namn = type === 'sub' && m.key === 'avrakning' ? 'Min avräkning' : type === 'sub' && m.key === 'forarlista' ? 'Mina förare' : m.variants?.[l.variant]?.name || m.name;
    return { key: m.key, namn, tone: TONE[m.tone] || TONE.green, beskrivning: m.variants?.[l.variant]?.beskrivning || m.beskrivning };
  }).filter(Boolean) as { key: string; namn: string; tone: string; beskrivning: string }[];
}
export { MODULES };

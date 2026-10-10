// Vilka appar ett konto ser och var de ligger. Byggs från licenserna och manifesten.
import { MODULES, moduleByKey, variantFor } from '@bolagsappar/modules';

export const PATH: Record<string, { main?: string; sub?: string; direct?: string }> = {
  avrakning: { main: 'avrakning', sub: 'min-avrakning' },
  forarlista: { main: 'forarlista', sub: 'mina-forare' },
  kassan: { sub: 'akarkassan' },
  verkstad: { direct: 'verkstad' },
  skadeflode: { sub: 'skadeflode', direct: 'skadeflode' },
  korjournal: { sub: 'korjournal' }
};

export interface AppEntry { key: string; name: string; icon: string; tone: string; path: string; variant: string; status: string }
export function myApps(tenantType: string, licenses: any[]): AppEntry[] {
  return licenses.filter(l => l.status === 'aktiv' || l.status === 'kommer').map(l => {
    const m = moduleByKey[l.module_key]; if (!m) return null;
    const variant = variantFor(m, tenantType);
    const path = (PATH[m.key] as any)?.[variant];
    if (!path || (m.variants as any)[variant]?.erbjuds) return null;
    return { key: m.key, name: (m.variants as any)[variant]?.name || m.name, icon: m.icon, tone: m.tone, path, variant, status: l.status };
  }).filter(Boolean).sort((a: any, b: any) => MODULES.findIndex(m => m.key === a.key) - MODULES.findIndex(m => m.key === b.key)) as AppEntry[];
}
export { MODULES, moduleByKey, variantFor };

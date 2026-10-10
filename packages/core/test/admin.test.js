import { describe, it, expect } from 'vitest';
import { kundlista, konton, fastnar, guiderAvslutade, modulStatistik, leveranser } from '../src/admin.js';

const tenants = [
  { id: 'p', type: 'platform', name: 'Bolagsappar' },
  { id: 'm', type: 'main', name: 'Huvud', settings: {} },
  { id: 's1', type: 'sub', parent_id: 'm', name: 'A' }, { id: 's2', type: 'sub', parent_id: 'm', name: 'B' },
  { id: 'j', type: 'main', name: 'Bygg', settings: { status: 'bygger', dag: 6 } }
];
const licenses = [
  { tenant_id: 'm', module_key: 'avrakning', variant: 'main', status: 'aktiv' },
  { tenant_id: 's1', module_key: 'kassan', variant: 'sub', status: 'aktiv' }, { tenant_id: 's2', module_key: 'kassan', variant: 'sub', status: 'aktiv' }
];
const checklists = { kassan: { sub: [{ key: 'a', title: 'A' }, { key: 'b', title: 'B' }] } };
const progress = [{ tenant_id: 's1', module_key: 'kassan', step_key: 'a' }, { tenant_id: 's1', module_key: 'kassan', step_key: 'b' }, { tenant_id: 's2', module_key: 'kassan', step_key: 'a' }];

describe('admin', () => {
  it('kunder och konton', () => {
    const K = kundlista(tenants, licenses, [{ key: 'avrakning', name: 'Avräkning' }]);
    expect(K.map(k => [k.namn, k.underkunder, k.status])).toEqual([['Huvud', 2, 'Aktiv'], ['Bygg', 0, 'Bygger, dag 6 av 14']]);
    expect(K[0].moduler).toEqual(['Avräkning']);
    expect(konton(tenants)).toEqual({ totalt: 4, main: 2, sub: 2, direct: 0 });
    expect(leveranser(tenants)).toHaveLength(1);
  });
  it('var fastnar användarna', () => {
    const F = fastnar(licenses, progress, checklists);
    expect(F[0]).toMatchObject({ steg: 'b', startat: 2, klar: 1, fastnar: 0.5 });
    expect(guiderAvslutade(licenses, progress, checklists)).toBe(0.5);
    expect(modulStatistik([{ key: 'kassan', name: 'Åkarkassan', variants: { sub: {}, main: {} } }], licenses)[0]).toMatchObject({ konton: 2, varianter: ['sub'] });
  });
});

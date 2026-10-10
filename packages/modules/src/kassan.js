import { defineModule } from './define.js';
import { filerFor } from '@bolagsappar/core/filetypes';
export default defineModule({
  key: 'kassan', name: 'Åkarkassan', version: '2.0.0', industry: ['taxi'], icon: 'wallet', tone: 'blue',
  beskrivning: 'Lön, kassa, bro och Sturup för åkerier.',
  variants: {
    main: { name: 'Åkarkassan', erbjuds: true, routes: [], beskrivning: 'Erbjuds till åkarna. Ni ser bara om den är aktiv.' },
    sub: { name: 'Åkarkassan', routes: ['oversikt', 'lon', 'kassa', 'bro', 'personal', 'korpass', 'ekonomi', 'bokforing', 'installningar'], beskrivning: 'Lön, kassaredovisning, bro och Sturup, personal och avtal, ekonomi, bokföring och bank.' }
  },
  uploads: filerFor('kassan').map(f => ({ key: f.key, label: f.label, required: !!f.kravs, auto: !!f.auto, parser: f.parser })),
  guide: { main: 'kassan/main', sub: 'kassan/sub' },
  shares: [],
  receives: [{ from: 'avrakning', kind: 'akaravrakning' }],
  config: { engineVariant: 'akarkassan' },
  pricing: { sub: '[PRIS]' }
});

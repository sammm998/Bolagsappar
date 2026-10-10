import { defineModule } from './define.js';
import { PRISER } from './priser.js';
import { filerFor } from '@bolagsappar/core/filetypes';

export default defineModule({
  key: 'avrakning', name: 'Avräkning', version: '2.0.0', industry: ['taxi'], icon: 'receipt', tone: 'green',
  beskrivning: 'Månadsavräkning mellan central och åkare.',
  variants: {
    main: { name: 'Avräkning', routes: ['filer', 'kontroll', 'godkann', 'publicera', 'historik', 'installningar'], beskrivning: 'Hela månadsflödet: filer, kontroll, godkänn, publicera till åkare, Visma-underlag.' },
    sub: { name: 'Min avräkning', readOnly: true, routes: ['manad', 'per-bil', 'historik'], beskrivning: 'Din del av centralens avräkning, per bil, med PDF och historik.' }
  },
  uploads: filerFor('avrakning').filter(f => f.key !== 'bilreg').map(f => ({ key: f.key, label: f.label, required: !!f.kravs, parser: f.parser })),
  guide: { main: 'avrakning/main', sub: 'avrakning/sub' },
  shares: [{ kind: 'akaravrakning', to: 'sub', on: 'publish', matchBy: 'settings/bolag' }],
  pricing: { main: PRISER.avrakning.main, sub: { default: 'ingår' } }
});

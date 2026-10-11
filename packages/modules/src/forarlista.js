import { defineModule } from './define.js';
import { PRISER } from './priser.js';
import { filerFor } from '@bolagsappar/core/filetypes';
export default defineModule({
  key: 'forarlista', name: 'Förarlista', version: '1.1.0', industry: ['taxi'], icon: 'users', tone: 'amber',
  beskrivning: 'Förare från TaxiCaller, aktiva och inaktiva, per åkare.',
  variants: {
    main: { name: 'Förarlista', routes: ['lista'], beskrivning: 'Alla förare, aktiva och inaktiva, per åkare. Sök och export.' },
    sub: { name: 'Mina förare', readOnly: true, routes: ['lista'], beskrivning: 'Bara egna förare. Kopplas till Åkarkassans personal.' }
  },
  uploads: filerFor('forarlista').map(f => ({ key: f.key, label: f.label, required: !!f.kravs, parser: f.parser })),
  guide: { main: 'forarlista/main', sub: 'forarlista/sub' },
  shares: [{ kind: 'forare', to: 'sub', on: 'inlasning', matchBy: 'akeri' }],
  pricing: { main: PRISER.forarlista.main, sub: { default: 'ingår' } }
});

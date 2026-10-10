import { defineModule } from './define.js';
export default defineModule({
  key: 'forarlista', name: 'Förarlista', version: '1.1.0', industry: ['taxi'], icon: 'users', tone: 'amber',
  beskrivning: 'Förare från TaxiCaller, aktiva och inaktiva, per åkare.',
  variants: {
    main: { name: 'Förarlista', routes: ['lista'], beskrivning: 'Alla förare, aktiva och inaktiva, per åkare. Sök och export.' },
    sub: { name: 'Mina förare', readOnly: true, routes: ['lista'], beskrivning: 'Bara egna förare. Kopplas till Åkarkassans personal.' }
  },
  uploads: [],
  guide: { main: 'forarlista/main', sub: 'forarlista/sub' },
  shares: [{ kind: 'forare', to: 'sub', on: 'sync', matchBy: 'settings/bilar' }],
  pricing: { main: '[PRIS]', sub: { default: 'ingår' } }
});

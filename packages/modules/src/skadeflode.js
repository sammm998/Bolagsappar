import { defineModule } from './define.js';
export default defineModule({
  key: 'skadeflode', name: 'Skadeflöde', version: '0.9.0', industry: ['taxi', 'verkstad'], icon: 'shield', tone: 'amber', status: 'kommer', slapps: '[datum]',
  beskrivning: 'Skadeärenden och mejl till skadereglerare.',
  variants: {
    main: { name: 'Skadeflöde', erbjuds: true, routes: [] },
    sub: { name: 'Skadeflöde', routes: ['inkorg', 'arenden', 'kontroll'], beskrivning: 'Skadeärenden för egna bilar, bilder, mejl till skadereglerare.' },
    direct: { name: 'Skadeflöde', routes: ['inkorg', 'arenden', 'kontroll'] }
  },
  uploads: [{ key: 'bild', label: 'Skadebilder' }],
  guide: { sub: 'skadeflode/sub', direct: 'skadeflode/direct' },
  pricing: { sub: '[PRIS]', direct: '[PRIS]' }
});

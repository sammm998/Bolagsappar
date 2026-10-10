import { defineModule } from './define.js';
import { PRISER } from './priser.js';
export default defineModule({
  key: 'korjournal', name: 'Körjournal', version: '0.1.0', industry: ['taxi'], icon: 'calendar', tone: 'blue', status: 'ny', fran: 'Bolagsappar',
  beskrivning: 'Körjournal för alla bilar, skapad från körningarna i TaxiCaller.',
  variants: { sub: { name: 'Körjournal', routes: ['journal'] } },
  guide: { sub: 'korjournal/sub' },
  pricing: { sub: PRISER.korjournal.sub }
});

import { defineModule } from './define.js';
import { PRISER } from './priser.js';
import { filerFor } from '@bolagsappar/core/filetypes';
export default defineModule({
  key: 'verkstad', name: 'Verkstad', version: '1.0.0', industry: ['verkstad'], icon: 'brush', tone: 'red',
  beskrivning: 'Ärenden, offert, faktura och momsfaktura mot försäkringsbolag.',
  variants: { direct: { name: 'Verkstad', routes: ['oversikt', 'arenden', 'jobb', 'fakturor', 'betalningar', 'ekonomi', 'bokforing', 'register', 'installningar'] } },
  uploads: filerFor('verkstad').map(f => ({ key: f.key, label: f.label, parser: f.parser })),
  guide: { direct: 'verkstad/direct' },
  pricing: { direct: PRISER.verkstad.direct }
});

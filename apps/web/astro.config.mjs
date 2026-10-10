import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// taxiavrakning.se pekar till /taxi och akaravrakning.se till /akeri (omdirigering hos DNS-leverantören).
export default defineConfig({
  site: 'https://bolagsappar.se',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'auto' },
  compressHTML: true
});

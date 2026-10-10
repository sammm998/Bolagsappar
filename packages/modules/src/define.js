/**
 * En app beskriver sig själv i en fil. En ny app är en ny mapp, inte en ändring i plattformen.
 * variants styr vad huvudkund och underkund ser, uploads blir stegen i Månadens filer,
 * guide blir välkomstguiden, kom-igång-listan och hjälppanelen, shares säger vad som publiceras nedåt.
 */
export function defineModule(m) {
  if (!m.key || !m.name) throw new Error('Modulen saknar key eller name');
  return { version: '1.0.0', industry: [], uploads: [], shares: [], status: 'aktiv', ...m };
}

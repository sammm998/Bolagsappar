// Regel: inga tankstreck (— eller –) i gränssnitt, guider och dokument. legacy/ är orörd och undantagen.
import fs from 'node:fs';
import path from 'node:path';
const ROOTS = ['apps', 'packages', 'supabase', 'docs', 'README.md', 'CLAUDE.md'];
const SKIP = /node_modules|dist|\.astro|\.expo|__snapshots__|\.snap$|pnpm-lock|\.png$|\.jpg$|\.woff2?$|\.ico$/;
const bad = [];
const walk = p => {
  if (!fs.existsSync(p) || SKIP.test(p)) return;
  const st = fs.statSync(p);
  if (st.isDirectory()) return fs.readdirSync(p).forEach(f => walk(path.join(p, f)));
  const t = fs.readFileSync(p, 'utf8');
  t.split('\n').forEach((l, i) => { if (/[–—]/.test(l.replace(/\[[^\]]*\]/g, ''))) bad.push(`${p}:${i + 1}: ${l.trim().slice(0, 120)}`); });
};
ROOTS.forEach(walk);
if (bad.length) { console.error('Tankstreck hittades (använd komma, punkt eller parentes):\n' + bad.join('\n')); process.exit(1); }
console.log('Inga tankstreck.');

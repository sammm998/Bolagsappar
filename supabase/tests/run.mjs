// Kör RLS-testerna. Kräver en Postgres (DATABASE_URL, standard postgres:postgres@localhost:5432).
import { spawnSync } from 'node:child_process';
const r = spawnSync(process.execPath, ['--test', new URL('./rls.test.mjs', import.meta.url).pathname], { stdio: 'inherit' });
process.exit(r.status ?? 1);

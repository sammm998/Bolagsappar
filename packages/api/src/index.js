export { createLocalBackend, AccessError } from './local.js';
export { createSupabaseBackend } from './supabase.js';
export { docApi, runtimeFor } from './docs.js';
export { buildSeed, DEMO_LOGINS, T, U, slugify, initials } from './seed.js';

/**
 * Välj backend. Med VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY används Supabase, annars den lokala
 * (demo och utveckling). Den lokala fylls med demodata första gången.
 */
export async function createBackend(env = {}) {
  if (env.url && env.anonKey) {
    const { createSupabaseBackend } = await import('./supabase.js');
    return createSupabaseBackend(env);
  }
  const { createLocalBackend } = await import('./local.js');
  const { seedDemo } = await import('./demo.js');
  const b = createLocalBackend();
  await seedDemo(b);
  return b;
}

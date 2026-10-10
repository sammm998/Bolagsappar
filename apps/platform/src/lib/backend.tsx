import { createContext, useContext, type ReactNode } from 'react';
import { createBackend } from '@bolagsappar/api';

// Backend: Supabase om nycklarna finns, annars den lokala med demodata (Taxi Malmö).
export type Backend = any;
let promise: Promise<Backend> | null = null;
export function loadBackend(): Promise<Backend> {
  return (promise ||= createBackend({ url: import.meta.env.VITE_SUPABASE_URL, anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY }));
}
const Ctx = createContext<Backend>(null);
export const BackendProvider = ({ value, children }: { value: Backend; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useBackend = (): Backend => useContext(Ctx);

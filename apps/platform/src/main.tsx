import '@bolagsappar/ui/fonts';
import '@bolagsappar/ui/tokens.css';
import '@bolagsappar/ui/components.css';
import './app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { ToastProvider } from '@bolagsappar/ui';
import { BackendProvider, loadBackend } from './lib/backend';
import { SessionProvider } from './lib/session';
import { wireInvalidation } from './lib/q';
import { router } from './router';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const root = createRoot(document.getElementById('root')!);
root.render(<div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', color: '#6B7385', fontFamily: 'system-ui' }}>Startar…</div>);

loadBackend().then(backend => {
  wireInvalidation(backend, qc);
  (window as any).__ba = backend;
  root.render(
    <StrictMode>
      <BackendProvider value={backend}>
        <QueryClientProvider client={qc}>
          <ToastProvider>
            <SessionProvider>
              <RouterProvider router={router} />
            </SessionProvider>
          </ToastProvider>
        </QueryClientProvider>
      </BackendProvider>
    </StrictMode>
  );
}).catch(e => {
  console.error(e);
  root.render(<div style={{ padding: 24, fontFamily: 'system-ui' }}><h1>Plattformen kunde inte starta</h1><p>{String(e?.message || e)}</p></div>);
});

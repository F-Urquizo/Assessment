import { useEffect, useState } from 'react';
import Studio from './components/Studio';
import Marketplace from './components/Marketplace';
import Favorites from './components/Favorites';
import { AuthProvider } from './context/auth-provider';
import { FavoritesProvider } from './context/FavoritesProvider';
import { fetchOptions } from './lib/api';
import { MOCK_OPTIONS } from './lib/marketplace-mock';
import type { Options } from './types';

type Mode = 'marketplace' | 'favorites' | 'studio';

const TABS: ReadonlyArray<{ id: Mode; label: string }> = [
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'studio', label: 'Studio' },
];

export default function App() {
  const [options, setOptions] = useState<Options | null>(null);
  const [mode, setMode] = useState<Mode>('marketplace');

  useEffect(() => {
    // Degrade gracefully: if /options is unreachable, fall back to MOCK_OPTIONS so
    // the marketplace stays reviewable on localhost. Real data loads when the API
    // is up. (Studio's spec form is limited under mock options — expected.)
    fetchOptions()
      .then(setOptions)
      .catch(() => setOptions(MOCK_OPTIONS));
  }, []);

  if (!options)
    return <div style={{ padding: 48, fontFamily: 'monospace' }}>Loading…</div>;

  return (
    // Auth + favourites wrap the whole app. AuthProvider is the mock today; it
    // swaps to Ramiro's real provider via context/auth-provider.ts (one line).
    <AuthProvider>
      <FavoritesProvider>
        {/* TEMP nav — Ramiro owns the real nav/routing integration (auth shell). */}
        <div className="mode-nav" role="tablist" aria-label="App section">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={mode === t.id}
              className={'mode-tab' + (mode === t.id ? ' active' : '')}
              onClick={() => setMode(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {mode === 'marketplace' && <Marketplace options={options} />}
        {mode === 'favorites' && <Favorites />}
        {mode === 'studio' && <Studio options={options} />}
      </FavoritesProvider>
    </AuthProvider>
  );
}

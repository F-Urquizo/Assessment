import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import Studio from './components/Studio';
import Marketplace from './components/Marketplace';
import Favorites from './components/Favorites';
import { AuthProvider } from './context/auth-provider';
import { FavoritesProvider } from './context/FavoritesProvider';
import { MyListingsProvider } from './context/MyListingsProvider';
import { fetchOptions } from './lib/api';
import { MOCK_OPTIONS } from './lib/marketplace-mock';
import type { Options } from './types';

const TABS: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/', label: 'Marketplace' },
  { to: '/favorites', label: 'Favorites' },
  { to: '/studio', label: 'Studio' },
];

export default function App() {
  const [options, setOptions] = useState<Options | null>(null);

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
        <MyListingsProvider options={options}>
        {/* TEMP nav — Ramiro owns the real nav/routing integration (auth shell). */}
        <div className="mode-nav" role="tablist" aria-label="App section">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) => 'mode-tab' + (isActive ? ' active' : '')}
            >
              {t.label}
            </NavLink>
          ))}
        </div>
        {mode === 'marketplace' && <Marketplace options={options} />}
        {mode === 'favorites' && <Favorites />}
        {mode === 'studio' && <Studio options={options} />}
        </MyListingsProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}

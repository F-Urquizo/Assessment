import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import Studio from './components/Studio';
import Marketplace from './components/Marketplace';
import Favorites from './components/Favorites';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
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
    // Auth wraps everything; favourites + my-listings are per-user features
    // that consume it. AuthProvider swaps in context/auth-provider.ts.
    <AuthProvider>
      <FavoritesProvider>
        <MyListingsProvider options={options}>
          <nav className="mode-nav" aria-label="App section">
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
          </nav>
          <Routes>
            <Route path="/" element={<Marketplace options={options} />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/studio" element={<Studio options={options} />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            {/* /verify-email lands in the next step. */}
          </Routes>
        </MyListingsProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}

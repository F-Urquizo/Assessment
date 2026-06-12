import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import Studio from './components/Studio';
import Marketplace from './components/Marketplace';
import Favorites from './components/Favorites';
import ModeNav from './components/ModeNav';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ListingDetailPage from './pages/ListingDetailPage';
import { AuthProvider } from './context/auth-provider';
import { FavoritesProvider } from './context/FavoritesProvider';
import { MyListingsProvider } from './context/MyListingsProvider';
import { fetchOptions } from './lib/api';
import { MOCK_OPTIONS } from './lib/marketplace-mock';
import type { Options } from './types';

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
        <MyListingsProvider>
          <a href="#main-content" className="skip-link">Skip to main content</a>
          <ModeNav />
          <main id="main-content">
          <Routes>
            <Route path="/" element={<Marketplace options={options} />} />
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            <Route
              path="/favorites"
              element={
                <ProtectedRoute>
                  <Favorites />
                </ProtectedRoute>
              }
            />
            <Route path="/studio" element={<Studio options={options} />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
          </Routes>
          </main>
        </MyListingsProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}

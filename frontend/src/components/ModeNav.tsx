import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Top-right app navigation. Per-user tabs (Favorites) only render with a
 * session; the right edge shows login/register links or the account chip
 * with logout depending on auth state.
 */
export default function ModeNav() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const tabs = [
    { to: '/', label: 'Marketplace' },
    ...(isAuthenticated ? [{ to: '/favorites', label: 'Favorites' }] : []),
    { to: '/studio', label: 'Studio' },
  ];

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      navigate('/');
    }
  }

  return (
    <nav className="mode-nav" aria-label="App section">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) => 'mode-tab' + (isActive ? ' active' : '')}
        >
          {t.label}
        </NavLink>
      ))}

      {/* While the silent refresh is in flight, render neither state to avoid
          a logged-out flash for users about to be restored. */}
      {!loading &&
        (isAuthenticated ? (
          <>
            <span className="mode-user" aria-label={`Session: ${user?.email}`}>
              {user?.email}
            </span>
            <button
              type="button"
              className="mode-tab mode-logout"
              onClick={handleLogout}
              disabled={signingOut}
            >
              {signingOut ? 'Logging out…' : 'Log out'}
            </button>
          </>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) => 'mode-tab' + (isActive ? ' active' : '')}
          >
            Log in
          </NavLink>
        ))}
    </nav>
  );
}

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Top-right app navigation. Selling is a primary action, so it gets its own
 * top-level entry (deep-linking into the Studio's Sell tab) rather than being
 * buried inside "Studio" — which is now surfaced under the clearer label
 * "Valuation". Per-user tabs (Favorites) only render with a session; the right
 * edge shows login or the account chip + logout depending on auth state.
 *
 * To stop the fixed bar covering content, it collapses to a hamburger while the
 * user scrolls down, and expands back to the full bar on scroll up, on hover, or
 * when the hamburger is tapped/activated (touch + keyboard).
 */
export default function ModeNav() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  const [scrolledDown, setScrolledDown] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false); // tap/keyboard pin (no hover on touch)
  const expanded = !scrolledDown || hovered || open;

  // Collapse on scroll-down past a small threshold; expand on scroll-up or near
  // the top. rAF-throttled; the ±4px deadband stops jitter from flipping it.
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 80) setScrolledDown(false);
        else if (y > lastY + 4) {
          setScrolledDown(true);
          setOpen(false);
        } else if (y < lastY - 4) setScrolledDown(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const onStudio = location.pathname === '/studio';
  const tab = new URLSearchParams(location.search).get('tab');
  const onSell = onStudio && tab === 'sell';

  const tabs = [
    { to: '/', label: 'Marketplace', active: location.pathname === '/' },
    { to: '/studio?tab=sell', label: 'Sell', active: onSell },
    ...(isAuthenticated
      ? [
          {
            to: '/favorites',
            label: 'Favorites',
            active: location.pathname === '/favorites',
          },
        ]
      : []),
    { to: '/studio', label: 'Valuation', active: onStudio && !onSell },
  ];

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      setOpen(false);
      navigate('/');
    }
  }

  return (
    <nav
      className={'mode-nav' + (expanded ? '' : ' collapsed')}
      aria-label="App section"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="mode-burger"
        aria-label="Show navigation"
        aria-expanded={expanded}
        aria-hidden={expanded || undefined}
        inert={expanded || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">☰</span>
      </button>

      {/* `inert` while collapsed keeps the (visually hidden, still-animating)
          links out of the tab order and a11y tree. */}
      <div className="mode-nav-items" inert={!expanded || undefined}>
        <div className="mode-nav-inner">
          {tabs.map((t) => (
            <Link
              key={t.label}
              to={t.to}
              className={'mode-tab' + (t.active ? ' active' : '')}
              aria-current={t.active ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {t.label}
            </Link>
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
              <Link
                to="/login"
                className={
                  'mode-tab' + (location.pathname === '/login' ? ' active' : '')
                }
                onClick={() => setOpen(false)}
              >
                Log in
              </Link>
            ))}
        </div>
      </div>
    </nav>
  );
}

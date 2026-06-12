import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthApiError, resendVerification } from '../lib/api';
import { EMAIL_REGEX, PASSWORD_MIN_LENGTH } from '../lib/auth-types';

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // ProtectedRoute sends users here with the page they wanted in state.from.
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // When login fails with 403 the account exists but isn't verified — offer to
  // re-send the link rather than leaving the user stuck.
  const [unverified, setUnverified] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Already logged in (e.g. silent refresh finished) → no reason to be here.
  useEffect(() => {
    if (!loading && isAuthenticated) navigate(from, { replace: true });
  }, [loading, isAuthenticated, from, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setUnverified(false);
    setResendState('idle');

    // Mirror backend validation to save a round-trip on obvious errors.
    if (!EMAIL_REGEX.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Your password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof AuthApiError && err.statusCode === 401) {
        setError('Incorrect email or password.');
      } else if (err instanceof AuthApiError && err.statusCode === 403) {
        setError('Your email is not verified. Check your inbox.');
        setUnverified(true);
      } else {
        setError(err instanceof Error ? err.message : 'Unexpected error.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResendState('sending');
    try {
      await resendVerification(email);
    } finally {
      // The endpoint always 202s (no enumeration), so we always confirm.
      setResendState('sent');
    }
  }

  // Move focus to the error so screen readers and keyboard users land on it.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <h1 id="login-title" className="auth-title">
          Log in
        </h1>
        <p className="auth-note">Access your favorites and list vehicles.</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="login-email">
              <span className="num">01</span> Email address
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">
              <span className="num">02</span> Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>

          {error && (
            <p
              id="login-error"
              className="auth-error"
              role="alert"
              tabIndex={-1}
              ref={errorRef}
            >
              {error}
            </p>
          )}

          {unverified &&
            (resendState === 'sent' ? (
              <p className="auth-success" role="status">
                If that account needs verifying, a new link is on its way — check
                your inbox.
              </p>
            ) : (
              <button
                type="button"
                className="linkbtn auth-resend"
                onClick={handleResend}
                disabled={resendState === 'sending'}
              >
                {resendState === 'sending'
                  ? 'Sending…'
                  : 'Resend verification email'}
              </button>
            ))}

          <div className="actions">
            <button type="submit" className="appraise" disabled={submitting}>
              {submitting ? 'Logging in…' : 'Log in'}
            </button>
          </div>
        </form>

        <p className="auth-alt">
          Don&apos;t have an account? <Link to="/register">Sign up</Link>
        </p>
      </section>
    </main>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthApiError, verifyEmail } from '../lib/api';

type Status = 'verifying' | 'success' | 'invalid' | 'expired';

/**
 * Landing page for the verification link sent by email
 * (FRONTEND_URL/verify-email?token=<raw>). Consumes the single-use token via
 * GET /auth/verify-email. 410 means expired or already used — per the API
 * contract those get a "request a new link" prompt instead of a generic error.
 */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'invalid');
  // The token is single-use: a second call (e.g. an effect re-run) would see
  // "already used" and show a false error.
  const fired = useRef(false);

  useEffect(() => {
    if (!token || fired.current) return;
    fired.current = true;
    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus(
          err instanceof AuthApiError && err.statusCode === 410
            ? 'expired'
            : 'invalid',
        );
      });
  }, [token]);

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="verify-title">
        <h1 id="verify-title" className="auth-title">
          Email verification
        </h1>

        {status === 'verifying' && (
          <p className="auth-note" role="status">
            Verifying your email…
          </p>
        )}

        {status === 'success' && (
          <>
            <p className="auth-success" role="status">
              Email verified! Your account is active.
            </p>
            <p className="auth-alt">
              <Link to="/login">Log in</Link> to continue.
            </p>
          </>
        )}

        {status === 'expired' && (
          <>
            <p className="auth-error" role="alert">
              This link has expired or has already been used.
            </p>
            <p className="auth-alt">
              If your account is not yet verified, sign up again or
              contact the administrator to receive a new link.{' '}
              <Link to="/login">Back to login</Link>
            </p>
          </>
        )}

        {status === 'invalid' && (
          <>
            <p className="auth-error" role="alert">
              The verification link is not valid.
            </p>
            <p className="auth-alt">
              Make sure you copied the full URL from the email.{' '}
              <Link to="/login">Back to login</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}

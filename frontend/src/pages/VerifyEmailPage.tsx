import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthApiError, resendVerification, verifyEmail } from '../lib/api';
import { EMAIL_REGEX } from '../lib/auth-types';

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
            <ResendForm />
            <p className="auth-alt">
              <Link to="/login">Back to login</Link>
            </p>
          </>
        )}

        {status === 'invalid' && (
          <>
            <p className="auth-error" role="alert">
              The verification link is not valid.
            </p>
            <p className="auth-note">
              Make sure you copied the full URL from the email, or request a fresh
              link below.
            </p>
            <ResendForm />
            <p className="auth-alt">
              <Link to="/login">Back to login</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}

/** Lets a user with a dead/expired link request a new verification email. The
 *  endpoint never reveals whether the account exists, so the confirmation is
 *  deliberately non-committal. */
function ResendForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'invalid'>('idle');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_REGEX.test(email)) {
      setState('invalid');
      return;
    }
    setState('sending');
    try {
      await resendVerification(email);
    } finally {
      setState('sent');
    }
  }

  if (state === 'sent') {
    return (
      <p className="auth-success" role="status">
        If that account needs verifying, a new link is on its way — check your inbox.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate style={{ marginTop: 18 }}>
      <div className="field">
        <label htmlFor="resend-email">
          <span className="num">↺</span> Email address
        </label>
        <input
          id="resend-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={state === 'invalid' ? 'resend-error' : undefined}
        />
      </div>
      {state === 'invalid' && (
        <p id="resend-error" className="auth-error" role="alert">
          Enter a valid email address.
        </p>
      )}
      <div className="actions">
        <button type="submit" className="appraise" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send a new link'}
        </button>
      </div>
    </form>
  );
}

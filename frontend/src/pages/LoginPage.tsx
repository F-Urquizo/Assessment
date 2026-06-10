import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthApiError } from '../lib/api';
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
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Already logged in (e.g. silent refresh finished) → no reason to be here.
  useEffect(() => {
    if (!loading && isAuthenticated) navigate(from, { replace: true });
  }, [loading, isAuthenticated, from, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Mirror backend validation to save a round-trip on obvious errors.
    if (!EMAIL_REGEX.test(email)) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof AuthApiError && err.statusCode === 401) {
        setError('Correo o contraseña incorrectos.');
      } else if (err instanceof AuthApiError && err.statusCode === 403) {
        setError('Tu correo no está verificado. Revisa tu bandeja de entrada.');
      } else {
        setError(err instanceof Error ? err.message : 'Error inesperado.');
      }
    } finally {
      setSubmitting(false);
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
          Iniciar sesión
        </h1>
        <p className="auth-note">Accede a tus favoritos y publica vehículos.</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="login-email">
              <span className="num">01</span> Correo electrónico
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
              <span className="num">02</span> Contraseña
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

          <div className="actions">
            <button type="submit" className="appraise" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </button>
          </div>
        </form>

        <p className="auth-alt">
          ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
        </p>
      </section>
    </main>
  );
}

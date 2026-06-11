import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthApiError, register } from '../lib/api';
import { EMAIL_REGEX, PASSWORD_MIN_LENGTH } from '../lib/auth-types';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length) errorRef.current?.focus();
  }, [errors]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors([]);

    // Mirror backend validation to save a round-trip on obvious errors.
    const clientErrors: string[] = [];
    if (!EMAIL_REGEX.test(email))
      clientErrors.push('Ingresa un correo electrónico válido.');
    if (password.length < PASSWORD_MIN_LENGTH)
      clientErrors.push(
        `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
      );
    if (password !== confirm)
      clientErrors.push('Las contraseñas no coinciden.');
    if (clientErrors.length) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password);
      setDone(true);
    } catch (err) {
      if (err instanceof AuthApiError && err.statusCode === 409) {
        setErrors(['Este correo ya está registrado.']);
      } else if (err instanceof AuthApiError && err.statusCode === 422) {
        setErrors(
          Array.isArray(err.messages) ? err.messages : [err.messages],
        );
      } else {
        setErrors([err instanceof Error ? err.message : 'Error inesperado.']);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="register-title">
          <h1 id="register-title" className="auth-title">
            Revisa tu correo
          </h1>
          <p className="auth-success" role="status">
            Cuenta creada. Te enviamos un enlace para verificar{' '}
            <strong>{email}</strong> — ábrelo y después inicia sesión.
          </p>
          <p className="auth-alt">
            ¿Ya verificaste? <Link to="/login">Inicia sesión</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="register-title">
        <h1 id="register-title" className="auth-title">
          Crear cuenta
        </h1>
        <p className="auth-note">
          Guarda favoritos y publica tus vehículos en el marketplace.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="reg-email">
              <span className="num">01</span> Correo electrónico
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={errors.length ? 'register-errors' : undefined}
            />
          </div>

          <div className="field">
            <label htmlFor="reg-password">
              <span className="num">02</span> Contraseña
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="reg-password-hint"
            />
            <p id="reg-password-hint" className="auth-note" style={{ marginTop: 6, marginBottom: 0 }}>
              Mínimo {PASSWORD_MIN_LENGTH} caracteres.
            </p>
          </div>

          <div className="field">
            <label htmlFor="reg-confirm">
              <span className="num">03</span> Confirmar contraseña
            </label>
            <input
              id="reg-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-describedby={errors.length ? 'register-errors' : undefined}
            />
          </div>

          {errors.length > 0 && (
            <div
              id="register-errors"
              className="auth-error"
              role="alert"
              tabIndex={-1}
              ref={errorRef}
            >
              {errors.map((msg) => (
                <p key={msg}>{msg}</p>
              ))}
            </div>
          )}

          <div className="actions">
            <button type="submit" className="appraise" disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear cuenta'}
            </button>
          </div>
        </form>

        <p className="auth-alt">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </section>
    </main>
  );
}

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
          Verificación de correo
        </h1>

        {status === 'verifying' && (
          <p className="auth-note" role="status">
            Verificando tu correo…
          </p>
        )}

        {status === 'success' && (
          <>
            <p className="auth-success" role="status">
              ¡Correo verificado! Tu cuenta está activa.
            </p>
            <p className="auth-alt">
              <Link to="/login">Inicia sesión</Link> para continuar.
            </p>
          </>
        )}

        {status === 'expired' && (
          <>
            <p className="auth-error" role="alert">
              Este enlace ya expiró o ya fue utilizado.
            </p>
            <p className="auth-alt">
              Si tu cuenta aún no está verificada, regístrate de nuevo o
              contacta al administrador para recibir un nuevo enlace.{' '}
              <Link to="/login">Volver al login</Link>
            </p>
          </>
        )}

        {status === 'invalid' && (
          <>
            <p className="auth-error" role="alert">
              El enlace de verificación no es válido.
            </p>
            <p className="auth-alt">
              Revisa que hayas copiado la URL completa del correo.{' '}
              <Link to="/login">Volver al login</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}

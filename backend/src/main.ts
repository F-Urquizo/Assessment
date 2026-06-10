import * as fs from 'fs';
import * as http from 'http';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const tlsMode = process.env.TLS_MODE as 'direct' | 'proxy' | undefined;
  const isHttps = tlsMode === 'direct' || tlsMode === 'proxy';

  // TLS_MODE=direct: NestJS creates the HTTPS server itself.
  const httpsOptions =
    tlsMode === 'direct'
      ? {
          key: fs.readFileSync(process.env.TLS_KEY_PATH ?? 'certs/server.key'),
          cert: fs.readFileSync(process.env.TLS_CERT_PATH ?? 'certs/server.crt'),
        }
      : undefined;

  const app = await NestFactory.create(AppModule, { httpsOptions });

  // TLS_MODE=proxy: app sits behind an ingress that terminates TLS.
  // Trust the X-Forwarded-Proto header so req.protocol reflects 'https'.
  if (tlsMode === 'proxy') {
    (app.getHttpAdapter().getInstance() as any).set('trust proxy', 1);
  }

  app.use(
    helmet({
      // HSTS only when the browser connection is actually HTTPS (direct or via proxy).
      hsts: isHttps
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? true,
    credentials: true,
  });

  const port = Number(process.env.PORT ?? (tlsMode === 'direct' ? 3443 : 3000));
  await app.listen(port);

  // HTTP → HTTPS redirect: only when the app is the TLS edge (not behind a proxy).
  // A plain HTTP server on HTTP_REDIRECT_PORT (default 3080) issues 301s.
  if (tlsMode === 'direct') {
    const redirectPort = Number(process.env.HTTP_REDIRECT_PORT ?? 3080);
    http
      .createServer((req, res) => {
        const rawHost = req.headers.host ?? `localhost:${port}`;
        // Rewrite the port in the host header to the HTTPS port (only if needed).
        const host =
          port !== 443
            ? rawHost.replace(/:.*$/, `:${port}`)
            : rawHost.replace(/:.*$/, '');
        res.writeHead(301, { Location: `https://${host}${req.url ?? '/'}` });
        res.end();
      })
      .listen(redirectPort);
    console.log(
      `[TLS] HTTP redirect :${redirectPort} → https://localhost:${port}`,
    );
  }

  console.log(
    `[Bootstrap] ${isHttps ? 'HTTPS' : 'HTTP'} on :${port} (TLS_MODE=${tlsMode ?? 'off'})`,
  );
}
bootstrap();

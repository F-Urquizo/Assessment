import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The frontend calls the same relative API paths the old Flask app used
// (/analyze, /compare, /predict, /api/intel, /options). In dev we proxy them
// to the NestJS gateway so there's no CORS dance and the ported client logic
// stays unchanged. Override the target with VITE_API_TARGET if needed.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET ?? 'http://127.0.0.1:3000'

  return {
    plugins: [react()],
    server: {
      proxy: Object.fromEntries(
        ['/analyze', '/compare', '/predict', '/api', '/options', '/health', '/listings', '/recommendations', '/favorites', '/auth'].map(
          (p) => [
            p,
            {
              target: apiTarget,
              changeOrigin: true,
              // Browser navigations (Accept: text/html) to SPA routes that share
              // a path with the API (/favorites) must load the app, not the API.
              bypass: (req: { headers: { accept?: string } }) =>
                req.headers.accept?.includes('text/html') ? '/index.html' : null,
            },
          ],
        ),
      ),
    },
    // Vitest config — jsdom + Testing Library. css:false skips importing studio.css
    // into the test runtime (components are tested for behaviour, not pixels).
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: false,
    },
  }
})

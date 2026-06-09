import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The frontend calls the same relative API paths the old Flask app used
// (/analyze, /compare, /predict, /api/intel, /options). In dev we proxy them
// to the NestJS gateway so there's no CORS dance and the ported client logic
// stays unchanged. Override the target with VITE_API_TARGET if needed.
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      ['/analyze', '/compare', '/predict', '/api', '/options', '/health'].map(
        (p) => [p, { target: API_TARGET, changeOrigin: true }],
      ),
    ),
  },
})

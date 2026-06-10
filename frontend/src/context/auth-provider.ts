// ── Auth provider SWAP POINT ──
// App.tsx imports `AuthProvider` from here. Today it's the mock. When Ramiro's
// real provider lands, this is the ONLY line that changes:
//
//   export { AuthProvider } from './AuthProvider';
//
// Keeping the swap isolated to this one line means Ramiro's push is new files
// (AuthProvider.tsx + auth UI) plus this single edit — no conflicts with the
// rest of the app.
export { AuthProvider } from './AuthProvider';

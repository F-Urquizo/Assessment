import { useEffect, useState } from 'react';
import Studio from './components/Studio';
import { fetchOptions } from './lib/api';
import type { Options } from './types';

export default function App() {
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOptions()
      .then(setOptions)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error)
    return (
      <div style={{ padding: 48, fontFamily: 'monospace' }}>
        ⚠ Could not reach the backend ({error}). Make sure the NestJS gateway and the
        Python model-service are running.
      </div>
    );
  if (!options)
    return <div style={{ padding: 48, fontFamily: 'monospace' }}>Loading studio…</div>;
  return <Studio options={options} />;
}

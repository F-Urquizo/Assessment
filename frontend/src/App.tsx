import { useEffect, useState } from 'react';
import Studio from './components/Studio';
import Marketplace from './components/Marketplace';
import { fetchOptions } from './lib/api';
import { MOCK_OPTIONS } from './lib/marketplace-mock';
import type { Options } from './types';

type Mode = 'studio' | 'marketplace';

export default function App() {
  const [options, setOptions] = useState<Options | null>(null);
  const [mode, setMode] = useState<Mode>('marketplace');

  useEffect(() => {
    // Degrade gracefully: if /options is unreachable, fall back to MOCK_OPTIONS so
    // the marketplace stays reviewable on localhost. Real data loads when the API
    // is up. (Studio's spec form is limited under mock options — expected.)
    fetchOptions()
      .then(setOptions)
      .catch(() => setOptions(MOCK_OPTIONS));
  }, []);

  if (!options)
    return <div style={{ padding: 48, fontFamily: 'monospace' }}>Loading…</div>;

  return (
    <>
      {/* TEMP nav — Ramiro owns the real nav/routing integration (auth shell). */}
      <div className="mode-nav" role="tablist" aria-label="App section">
        <button
          role="tab"
          aria-selected={mode === 'marketplace'}
          className={'mode-tab' + (mode === 'marketplace' ? ' active' : '')}
          onClick={() => setMode('marketplace')}
        >
          Marketplace
        </button>
        <button
          role="tab"
          aria-selected={mode === 'studio'}
          className={'mode-tab' + (mode === 'studio' ? ' active' : '')}
          onClick={() => setMode('studio')}
        >
          Studio
        </button>
      </div>
      {mode === 'marketplace' ? (
        <Marketplace options={options} />
      ) : (
        <Studio options={options} />
      )}
    </>
  );
}

import { useState } from 'react';
import { useGarage } from '../../context/GarageContext';
import { useStudio } from '../../context/StudioContext';
import { useMyListings } from '../../context/MyListingsContext';
import { compare } from '../../lib/api';
import type { CompareResult } from '../../types';
import GarageCard from './GarageCard';
import CompareTable from './CompareTable';

const MAX_COMPARE = 4;

type CompareState =
  | { status: 'idle' }
  | { status: 'loading'; count: number }
  | { status: 'done'; results: CompareResult[] }
  | { status: 'error'; message: string };

export default function GarageView() {
  const { cards, selectedIds, selectedCards, isSelected, remove, clear, toggleSelect } =
    useGarage();
  const { reopen, setActiveTab } = useStudio();
  const { startFromGarage } = useMyListings();
  const [compareState, setCompareState] = useState<CompareState>({ status: 'idle' });

  const resetCompare = () => setCompareState({ status: 'idle' });

  if (!cards.length) {
    return (
      <ViewHead>
        <div className="garage-empty">
          <div className="big">Your garage is empty</div>
          Appraise a vehicle, then press <b>＋ Save to garage</b> on the value plate.
          <br />
          Saved cars can be compared head-to-head.
        </div>
      </ViewHead>
    );
  }

  const selCount = selectedIds.length;

  const runCompare = async () => {
    const sel = selectedCards.slice(0, MAX_COMPARE);
    setCompareState({ status: 'loading', count: sel.length });
    try {
      const data = await compare(sel.map((c) => ({ ...c.payload, _label: c.label })));
      setCompareState({ status: 'done', results: data.results });
    } catch (e) {
      setCompareState({ status: 'error', message: (e as Error).message });
    }
  };

  const clearAll = () => {
    if (confirm('Clear the whole garage?')) {
      clear();
      resetCompare();
    }
  };

  return (
    <ViewHead>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 28,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: 'rgba(32,37,31,.6)',
          }}
        >
          {cards.length} saved · {selCount} selected
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <button
            className="appraise"
            style={{ padding: '13px 26px', opacity: selCount < 2 ? 0.4 : 1 }}
            disabled={selCount < 2}
            onClick={runCompare}
          >
            Compare {selCount >= 2 ? selCount : ''} →
          </button>
          <button className="linkbtn" onClick={clearAll}>
            clear all
          </button>
        </div>
      </div>

      <div className="garage-grid">
        {cards.map((card) => (
          <GarageCard
            key={card.id}
            card={card}
            selected={isSelected(card.id)}
            onToggle={() => {
              toggleSelect(card.id);
              resetCompare();
            }}
            onRemove={() => {
              remove(card.id);
              resetCompare();
            }}
            onReopen={() => reopen(card.payload)}
            onListCar={() => {
              startFromGarage(card);
              setActiveTab('sell');
            }}
          />
        ))}
      </div>

      <CompareOutput state={compareState} />
    </ViewHead>
  );
}

function CompareOutput({ state }: { state: CompareState }) {
  if (state.status === 'loading') {
    return (
      <div
        style={{
          marginTop: 24,
          fontSize: 11,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: 'rgba(32,37,31,.5)',
        }}
      >
        crunching {state.count} vehicles…
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="rec-empty" style={{ marginTop: 20 }}>
        ⚠ {state.message}
      </div>
    );
  }
  if (state.status === 'done') return <CompareTable results={state.results} />;
  return null;
}

function ViewHead({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="view-head">
        <div className="view-kicker">Workspace · 06</div>
        <div className="view-title">Your garage</div>
        <div className="view-sub">
          Saved appraisals live here in your browser. Tick two or more and compare them
          side-by-side — the studio crowns the cheapest and the best value-holder.
        </div>
      </div>
      {children}
    </>
  );
}

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Appraisal, GarageCard, Payload } from '../types';
import { vehLabel, vehMeta } from '../lib/labels';
import { GarageContext, type GarageContextValue } from './GarageContext';

const GKEY = 'bluebook_garage_v1';
const MAX_CARDS = 12;

function loadGarage(): GarageCard[] {
  try {
    return (JSON.parse(localStorage.getItem(GKEY) || '[]') as GarageCard[]) || [];
  } catch {
    return [];
  }
}

export function GarageProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<GarageCard[]>(loadGarage);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    localStorage.setItem(GKEY, JSON.stringify(cards));
  }, [cards]);

  const add = useCallback((payload: Payload, appraisal: Appraisal) => {
    const card: GarageCard = {
      id: Date.now(),
      payload: structuredClone(payload),
      label: vehLabel(payload),
      estimate: appraisal.estimate,
      low: appraisal.low,
      high: appraisal.high,
      meta: vehMeta(payload),
    };
    setCards((prev) => [card, ...prev].slice(0, MAX_CARDS));
  }, []);

  const remove = useCallback((id: number) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setCards([]);
    setSelected(new Set());
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const value = useMemo<GarageContextValue>(
    () => ({
      cards,
      selectedIds: cards.filter((c) => selected.has(c.id)).map((c) => c.id),
      selectedCards: cards.filter((c) => selected.has(c.id)),
      isSelected: (id: number) => selected.has(id),
      add,
      remove,
      clear,
      toggleSelect,
    }),
    [cards, selected, add, remove, clear, toggleSelect],
  );

  return <GarageContext.Provider value={value}>{children}</GarageContext.Provider>;
}

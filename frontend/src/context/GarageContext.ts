import { createContext, useContext } from 'react';
import type { Appraisal, GarageCard, Payload } from '../types';

export interface GarageContextValue {
  cards: GarageCard[];
  selectedIds: number[];
  selectedCards: GarageCard[];
  isSelected: (id: number) => boolean;
  add: (payload: Payload, appraisal: Appraisal) => void;
  remove: (id: number) => void;
  clear: () => void;
  toggleSelect: (id: number) => void;
}

export const GarageContext = createContext<GarageContextValue | null>(null);

export function useGarage(): GarageContextValue {
  const ctx = useContext(GarageContext);
  if (!ctx) throw new Error('useGarage must be used within a GarageProvider');
  return ctx;
}

import { createContext, useContext } from 'react';
import type { Listing, ListingStatus } from '../lib/marketplace-types';
import type { Payload } from '../types';

/** Sell-form values — all strings (form inputs); converted to numbers on save. */
export interface SellFormValues {
  manufacturer: string;
  model: string;
  year: string;
  odometer: string;
  cylinders: string;
  condition: string;
  fuel: string;
  titleStatus: string;
  transmission: string;
  drive: string;
  type: string;
  paintColor: string;
  state: string;
  askingPrice: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  status: ListingStatus;
}

export type SellField = keyof SellFormValues;

/** A garage car handed to the sell form via the "List this car →" bridge. */
export interface GarageBridge {
  payload: Payload;
  estimate: number;
  low: number;
  high: number;
}

export interface MyListingsContextValue {
  myListings: Listing[];
  form: SellFormValues;
  /** Non-null when the form is editing an existing listing. */
  editingId: string | null;
  setField: (name: SellField, value: string) => void;
  startNew: () => void;
  startFromGarage: (car: GarageBridge) => void;
  startEdit: (listing: Listing) => void;
  /** Validate + persist (optimistic). Returns an error message if invalid. */
  save: () => { ok: boolean; error?: string };
  remove: (id: string) => void;
  setStatus: (id: string, status: ListingStatus) => void;
}

export const MyListingsContext = createContext<MyListingsContextValue | null>(
  null,
);

export function useMyListings(): MyListingsContextValue {
  const ctx = useContext(MyListingsContext);
  if (!ctx)
    throw new Error('useMyListings must be used within a MyListingsProvider');
  return ctx;
}

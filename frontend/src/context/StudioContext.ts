import { createContext, useContext } from 'react';
import type {
  Analysis,
  FormField,
  FormValues,
  Options,
  Payload,
  TabName,
} from '../types';

export interface StudioContextValue {
  options: Options;

  form: FormValues;
  models: string[];
  setField: (name: FormField, value: string) => void;
  resetForm: () => void;

  analysis: Analysis | null;
  payload: Payload | null;
  baseline: Payload | null;
  baseEstimate: number | null;
  appraising: boolean;
  appraised: boolean;
  error: string | null;

  annualMiles: number;
  setAnnualMiles: (n: number) => void;
  reforecast: () => void;

  appraise: () => void;
  applyWhatIf: (key: string, value: string) => void;
  resetSim: () => void;
  reopen: (payload: Payload) => void;

  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  unlocked: boolean;
}

export const StudioContext = createContext<StudioContextValue | null>(null);

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within a StudioProvider');
  return ctx;
}

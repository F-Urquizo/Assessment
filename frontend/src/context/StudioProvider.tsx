import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  Analysis,
  FormValues,
  FormField,
  Options,
  Payload,
  TabName,
} from '../types';
import { analyze } from '../lib/api';
import { useToast } from './ToastContext';
import { StudioContext, type StudioContextValue } from './StudioContext';

const DEFAULT_ANNUAL_MILES = 12000;

// The Studio tab lives in the URL (`/studio?tab=sell`) so each tab — Sell in
// particular — is linkable from the top nav and survives Back/refresh.
const TAB_NAMES: readonly TabName[] = [
  'appraise',
  'drivers',
  'forecast',
  'deal',
  'market',
  'garage',
  'sell',
];

const SPEC_FIELDS: FormField[] = [
  'manufacturer', 'model', 'year', 'odometer', 'cylinders', 'condition', 'fuel',
  'title_status', 'transmission', 'drive', 'type', 'paint_color', 'state',
];

// Start every field blank: a pre-filled spec sheet reads as if the questions
// are already answered, which is confusing in the one-at-a-time wizard. The
// wizard requires each question to be answered before it can advance.
function defaultForm(): FormValues {
  return {
    manufacturer: '',
    model: '',
    year: '',
    odometer: '',
    cylinders: '',
    condition: '',
    fuel: '',
    title_status: '',
    transmission: '',
    drive: '',
    type: '',
    paint_color: '',
    state: '',
  };
}

function formFromPayload(p: Payload): FormValues {
  const out = {} as FormValues;
  for (const k of SPEC_FIELDS) out[k] = String(p[k]);
  return out;
}

export function StudioProvider({
  options,
  children,
}: {
  options: Options;
  children: ReactNode;
}) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialForm = useMemo(() => defaultForm(), []);
  const [form, setForm] = useState<FormValues>(initialForm);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [baseline, setBaseline] = useState<Payload | null>(null);
  const [baseEstimate, setBaseEstimate] = useState<number | null>(null);
  const [annualMiles, setAnnualMilesState] = useState(DEFAULT_ANNUAL_MILES);

  // Active tab is derived from the URL — single source of truth, so a deep link
  // or the Back button lands on the right tab. setActiveTab just rewrites it.
  const tabParam = searchParams.get('tab');
  const activeTab: TabName = TAB_NAMES.includes(tabParam as TabName)
    ? (tabParam as TabName)
    : 'appraise';
  const setActiveTab = useCallback(
    (tab: TabName) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'appraise') next.delete('tab');
          else next.set('tab', tab);
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const [appraising, setAppraising] = useState(false);
  const [appraised, setAppraised] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formRef = useRef(form);
  const payloadRef = useRef(payload);
  const baselineRef = useRef(baseline);
  const annualMilesRef = useRef(annualMiles);
  useEffect(() => void (formRef.current = form), [form]);
  useEffect(() => void (payloadRef.current = payload), [payload]);
  useEffect(() => void (baselineRef.current = baseline), [baseline]);
  useEffect(() => void (annualMilesRef.current = annualMiles), [annualMiles]);

  const runAnalysis = useCallback(
    async (next: Payload, fromForm: boolean): Promise<Analysis | null> => {
      if (fromForm) {
        setAppraising(true);
        setError(null);
      }
      try {
        const data = await analyze(next);
        setAnalysis(data);
        setPayload(next);
        if (fromForm) {
          setBaseline(structuredClone(next));
          setBaseEstimate(data.appraisal.estimate);
          setAppraised(true);
        }
        return data;
      } catch (e) {
        const msg = (e as Error).message;
        if (fromForm) setError('⚠ ' + msg);
        else toast('⚠ ' + msg);
        return null;
      } finally {
        if (fromForm) setAppraising(false);
      }
    },
    [toast],
  );

  const appraise = useCallback(() => {
    void runAnalysis({ ...formRef.current, annual_miles: annualMilesRef.current }, true);
  }, [runAnalysis]);

  const applyWhatIf = useCallback(
    (key: string, value: string) => {
      if (!payloadRef.current) return;
      void runAnalysis({ ...payloadRef.current, [key]: value }, false).then((data) => {
        if (data) toast(`Simulated · ${key} → ${value}`);
      });
    },
    [runAnalysis, toast],
  );

  const resetSim = useCallback(() => {
    if (!baselineRef.current) return;
    void runAnalysis(structuredClone(baselineRef.current), false).then((data) => {
      if (data) toast('Reset to actual car');
    });
  }, [runAnalysis, toast]);

  const reforecast = useCallback(() => {
    if (!payloadRef.current) return;
    void runAnalysis({ ...payloadRef.current, annual_miles: annualMilesRef.current }, false);
  }, [runAnalysis]);

  const reopen = useCallback(
    (p: Payload) => {
      setForm(formFromPayload(p));
      setActiveTab('appraise');
      const miles = Number(p.annual_miles) || DEFAULT_ANNUAL_MILES;
      setAnnualMilesState(miles);
      annualMilesRef.current = miles;
      void runAnalysis({ ...p, annual_miles: miles }, true).then((data) => {
        if (data) toast('Report reopened');
      });
    },
    [runAnalysis, toast, setActiveTab],
  );

  const setField = useCallback((name: FormField, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setForm(initialForm);
    setAppraised(false);
    setError(null);
  }, [initialForm]);

  const setAnnualMiles = useCallback((n: number) => {
    setAnnualMilesState(n);
    annualMilesRef.current = n;
  }, []);

  useEffect(() => {
    if (!new URLSearchParams(location.search).has('autosubmit')) return;
    const t = setTimeout(appraise, 400);
    return () => clearTimeout(t);
  }, [appraise]);

  const value = useMemo<StudioContextValue>(() => {
    const models = options.manufacturer_models[form.manufacturer] ?? [];
    return {
      options,
      form,
      models,
      setField,
      resetForm,
      analysis,
      payload,
      baseline,
      baseEstimate,
      appraising,
      appraised,
      error,
      annualMiles,
      setAnnualMiles,
      reforecast,
      appraise,
      applyWhatIf,
      resetSim,
      reopen,
      activeTab,
      setActiveTab,
      unlocked: analysis !== null,
    };
  }, [
    options, form, setField, resetForm, analysis, payload, baseline, baseEstimate,
    appraising, appraised, error, annualMiles, setAnnualMiles, reforecast, appraise,
    applyWhatIf, resetSim, reopen, activeTab, setActiveTab,
  ]);

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

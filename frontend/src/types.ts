export interface Options {
  manufacturers: string[];
  manufacturer_models: Record<string, string[]>;
  models?: string[];
  cylinders: number[];
  conditions: string[];
  fuels: string[];
  title_statuses: string[];
  transmissions: string[];
  drives: string[];
  types: string[];
  paint_colors: string[];
  states: string[];
  year_range: [number, number];
}

export interface FormValues {
  manufacturer: string;
  model: string;
  year: string;
  odometer: string;
  cylinders: string;
  condition: string;
  fuel: string;
  title_status: string;
  transmission: string;
  drive: string;
  type: string;
  paint_color: string;
  state: string;
}

export type FormField = keyof FormValues;

export interface Payload extends FormValues {
  annual_miles: number;
}

export interface Appraisal {
  estimate: number;
  low: number;
  high: number;
  known_model: boolean;
}

export interface DriverOption {
  value: string | number;
  delta: number;
  is_current: boolean;
}

export interface Driver {
  key: string;
  label: string;
  current: string;
  swing: number;
  options: DriverOption[];
}

export interface Recommendation {
  kind: 'condition' | 'title' | 'mileage' | string;
  label: string;
  detail: string;
  delta: number;
}

export interface ForecastPoint {
  year_offset: number;
  value: number;
  odometer: number;
}

export interface Forecast {
  avg_annual_loss: number;
  retained_pct: number | null;
  points: ForecastPoint[];
}

export interface MileagePoint {
  odometer: number;
  value: number;
}

export interface PopularModel {
  model: string;
  count: number;
}

export interface Market {
  comparable_count: number;
  segment_median: number;
  segment_label: string;
  segment_low: number;
  segment_high: number;
  percentile: number;
  vs_median: number;
  depreciation?: { pct_per_year: number | null } | null;
  popular_models?: PopularModel[];
}

export interface Analysis {
  appraisal: Appraisal;
  drivers: Driver[];
  recommendations: Recommendation[];
  forecast: Forecast;
  market: Market;
  mileage_curve: MileagePoint[];
}

export interface CompareResult {
  label: string;
  estimate: number;
  low: number;
  high: number;
  value_in_3yr: number;
  retained_3yr_pct: number;
  avg_annual_loss: number;
  segment_median: number;
  percentile: number;
  award_cheapest?: boolean;
  award_holds_value?: boolean;
  top_driver?: { label: string; swing: number } | null;
  top_rec?: { label: string; delta: number } | null;
}

export interface GarageCard {
  id: number;
  payload: Payload;
  label: string;
  estimate: number;
  low: number;
  high: number;
  meta: string;
}

export type TabName =
  | 'appraise'
  | 'drivers'
  | 'forecast'
  | 'deal'
  | 'market'
  | 'garage';

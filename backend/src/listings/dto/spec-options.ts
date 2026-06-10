/**
 * Allowed values for the constrained spec fields, mirrored from the
 * model-service `options.json`. `manufacturer` and `model` are intentionally
 * left as free strings — the model-service maps unknown models to "other"
 * rather than rejecting them, so over-constraining here would only diverge
 * from what the valuation actually accepts.
 */
export const CONDITIONS = [
  'excellent',
  'fair',
  'good',
  'like new',
  'new',
  'salvage',
  'unknown',
] as const;
export const FUELS = ['diesel', 'electric', 'gas', 'hybrid', 'other'] as const;
export const TITLE_STATUSES = [
  'clean',
  'lien',
  'missing',
  'parts only',
  'rebuilt',
  'salvage',
] as const;
export const TRANSMISSIONS = ['automatic', 'manual', 'other'] as const;
export const DRIVES = ['4wd', 'fwd', 'rwd', 'unknown'] as const;
export const TYPES = [
  'SUV',
  'bus',
  'convertible',
  'coupe',
  'hatchback',
  'mini-van',
  'offroad',
  'other',
  'pickup',
  'sedan',
  'truck',
  'unknown',
  'van',
  'wagon',
] as const;
export const PAINT_COLORS = [
  'black',
  'blue',
  'brown',
  'custom',
  'green',
  'grey',
  'orange',
  'purple',
  'red',
  'silver',
  'unknown',
  'white',
  'yellow',
] as const;
export const STATES = [
  'ak',
  'al',
  'ar',
  'az',
  'ca',
  'co',
  'ct',
  'dc',
  'de',
  'fl',
  'ga',
  'hi',
  'ia',
  'id',
  'il',
  'in',
  'ks',
  'ky',
  'la',
  'ma',
  'md',
  'me',
  'mi',
  'mn',
  'mo',
  'ms',
  'mt',
  'nc',
  'nd',
  'ne',
  'nh',
  'nj',
  'nm',
  'nv',
  'ny',
  'oh',
  'ok',
  'or',
  'pa',
  'ri',
  'sc',
  'sd',
  'tn',
  'tx',
  'ut',
  'va',
  'vt',
  'wa',
  'wi',
  'wv',
  'wy',
] as const;
export const CYLINDERS = [3, 4, 5, 6, 8, 10, 12] as const;

export const YEAR_MIN = 1990;
export const YEAR_MAX = 2021;

/**
 * The 13 spec fields, in the camelCase form used by the DTO and Prisma model.
 * Used to detect whether an update touched anything that invalidates the
 * stored valuation (and therefore requires a fresh model-service call).
 */
export const SPEC_FIELDS = [
  'manufacturer',
  'model',
  'year',
  'odometer',
  'cylinders',
  'condition',
  'fuel',
  'titleStatus',
  'transmission',
  'drive',
  'type',
  'paintColor',
  'state',
] as const;

export type SpecField = (typeof SPEC_FIELDS)[number];

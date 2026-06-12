import type { SellFormValues, SellField } from '../context/MyListingsContext';
import { EMAIL_REGEX } from './auth-types';

export type SellErrors = Partial<Record<SellField, string>>;

/**
 * Field-level validation for the sell form. Returns a map of field → message so
 * the form can show each error inline next to its input (instead of one pooled
 * message at the bottom). Mirrors — and is the front line for — the same rules
 * MyListings.buildInput enforces as a backstop before persisting.
 */
// Spec selects the backend requires (cylinders is optional — EVs have none).
const REQUIRED_SELECTS: SellField[] = [
  'manufacturer',
  'condition',
  'fuel',
  'titleStatus',
  'transmission',
  'drive',
  'type',
  'paintColor',
  'state',
];

export function validateSell(form: SellFormValues): SellErrors {
  const errors: SellErrors = {};

  // The form now starts blank, so every required choice must be made explicitly.
  for (const f of REQUIRED_SELECTS) {
    if (!form[f].trim()) errors[f] = 'Required.';
  }

  if (!form.model.trim()) {
    errors.model = 'Model is required.';
  }

  const year = Number(form.year);
  if (!form.year.trim() || !Number.isInteger(year) || year < 1900 || year > 2100) {
    errors.year = 'Enter a valid year.';
  }

  const odometer = Number(form.odometer);
  if (!form.odometer.trim() || !Number.isFinite(odometer) || odometer < 0) {
    errors.odometer = 'Enter the mileage (0 or more).';
  }

  const askingPrice = Number(form.askingPrice);
  if (!form.askingPrice.trim() || !Number.isFinite(askingPrice) || askingPrice < 1) {
    errors.askingPrice = 'Enter a valid asking price.';
  }

  if (!form.contactEmail.trim()) {
    errors.contactEmail = 'Contact email is required.';
  } else if (!EMAIL_REGEX.test(form.contactEmail.trim())) {
    errors.contactEmail = 'Enter a valid email address.';
  }

  return errors;
}

/** The first invalid field in visual form order — used to move focus on submit. */
export function firstErrorField(errors: SellErrors): SellField | null {
  const order: SellField[] = [
    'manufacturer',
    'model',
    'year',
    'odometer',
    'condition',
    'fuel',
    'titleStatus',
    'transmission',
    'drive',
    'type',
    'paintColor',
    'state',
    'askingPrice',
    'contactEmail',
  ];
  return order.find((f) => errors[f]) ?? null;
}

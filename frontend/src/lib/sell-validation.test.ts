import { describe, it, expect } from 'vitest';
import { firstErrorField, validateSell } from './sell-validation';
import type { SellFormValues } from '../context/MyListingsContext';

const valid: SellFormValues = {
  manufacturer: 'ford',
  model: 'f-150',
  year: '2019',
  odometer: '60000',
  cylinders: '6',
  condition: 'good',
  fuel: 'gas',
  titleStatus: 'clean',
  transmission: 'automatic',
  drive: 'rwd',
  type: 'truck',
  paintColor: 'white',
  state: 'tx',
  askingPrice: '25000',
  description: '',
  contactEmail: 'seller@example.com',
  contactPhone: '',
  status: 'draft',
};

describe('validateSell', () => {
  it('passes a fully valid form', () => {
    expect(validateSell(valid)).toEqual({});
  });

  it('flags a missing model', () => {
    expect(validateSell({ ...valid, model: '  ' }).model).toBeDefined();
  });

  it('flags a non-positive or empty asking price', () => {
    expect(validateSell({ ...valid, askingPrice: '0' }).askingPrice).toBeDefined();
    expect(validateSell({ ...valid, askingPrice: '' }).askingPrice).toBeDefined();
    expect(validateSell({ ...valid, askingPrice: 'abc' }).askingPrice).toBeDefined();
  });

  it('flags an implausible year', () => {
    expect(validateSell({ ...valid, year: '1700' }).year).toBeDefined();
    expect(validateSell({ ...valid, year: '' }).year).toBeDefined();
  });

  it('flags negative mileage', () => {
    expect(validateSell({ ...valid, odometer: '-5' }).odometer).toBeDefined();
  });

  it('flags a missing or malformed contact email', () => {
    expect(validateSell({ ...valid, contactEmail: '' }).contactEmail).toBeDefined();
    expect(validateSell({ ...valid, contactEmail: 'not-an-email' }).contactEmail).toBeDefined();
  });
});

describe('firstErrorField', () => {
  it('returns the first invalid field in form order', () => {
    const errors = validateSell({ ...valid, model: '', askingPrice: '0' });
    expect(firstErrorField(errors)).toBe('model');
  });

  it('returns null when there are no errors', () => {
    expect(firstErrorField({})).toBeNull();
  });
});

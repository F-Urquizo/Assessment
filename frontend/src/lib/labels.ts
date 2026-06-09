import type { Payload } from '../types';
import { fmtN } from './format';

export const vehLabel = (p: Pick<Payload, 'year' | 'manufacturer' | 'model'>): string =>
  `${p.year} ${p.manufacturer} ${p.model}`.toUpperCase();

export const vehMeta = (p: Payload): string =>
  `${fmtN(Number(p.odometer))} mi · ${p.condition} · ${p.title_status} · ${p.state.toUpperCase()}`;

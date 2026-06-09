export const fmt = (n: number): string =>
  '$' + Math.round(n).toLocaleString('en-US');

export const fmtK = (n: number): string => '$' + Math.round(n / 1000) + 'k';

export const fmtN = (n: number): string =>
  Math.round(n).toLocaleString('en-US');

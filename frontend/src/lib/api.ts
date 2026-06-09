import type { Analysis, CompareResult, Options, Payload } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `request to ${path} failed`);
  }
  return data as T;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function fetchOptions(): Promise<Options> {
  return request<Options>('/options');
}

export function analyze(payload: Payload): Promise<Analysis> {
  return postJson<Analysis>('/analyze', payload);
}

export function compare(
  vehicles: Array<Payload & { _label: string }>,
): Promise<{ results: CompareResult[] }> {
  return postJson<{ results: CompareResult[] }>('/compare', { vehicles });
}

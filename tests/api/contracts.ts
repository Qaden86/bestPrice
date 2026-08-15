import { expect } from '@playwright/test';

export type ResultRow = {
  url: string;
  status: string;
  reason: string;
  match: boolean;
  trace: unknown[];
};

export type Stats = {
  total: number;
  success: number;
  failed: number;
  successRate: number;
  failureRate: number;
  reasons: Record<string, number>;
  bucketDistribution: Record<string, number>;
  topFailingSteps: Array<{ step: string; count: number }>;
};

export function expectResultRows(value: unknown): asserts value is ResultRow[] {
  expect(Array.isArray(value)).toBe(true);
  for (const row of value as unknown[]) {
    expectRecord(row);
    expect(typeof row.url).toBe('string');
    expect(typeof row.status).toBe('string');
    expect(typeof row.reason).toBe('string');
    expect(typeof row.match).toBe('boolean');
    expect(Array.isArray(row.trace)).toBe(true);
  }
}

export function expectStats(value: unknown): asserts value is Stats {
  expectRecord(value);
  for (const key of [
    'total',
    'success',
    'failed',
    'successRate',
    'failureRate',
  ]) {
    expect(typeof value[key]).toBe('number');
  }
  expectNumberRecord(value.reasons);
  expectNumberRecord(value.bucketDistribution);
  expect(Array.isArray(value.topFailingSteps)).toBe(true);
}

export function expectRecord(
  value: unknown,
): asserts value is Record<string, unknown> {
  expect(value).not.toBeNull();
  expect(typeof value).toBe('object');
  expect(Array.isArray(value)).toBe(false);
}

function expectNumberRecord(
  value: unknown,
): asserts value is Record<string, number> {
  expectRecord(value);
  for (const item of Object.values(value)) {
    expect(typeof item).toBe('number');
  }
}

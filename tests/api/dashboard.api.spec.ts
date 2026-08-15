import { expect, test } from '@playwright/test';
import {
  DashboardApiClient,
  expectJsonResponse,
} from './clients/dashboardApiClient';
import { expectRecord, expectResultRows, expectStats } from './contracts';

test.describe('dashboard API', () => {
  test('returns normalized current results and aggregate statistics', async ({
    request,
  }) => {
    const api = new DashboardApiClient(request);
    const results = await expectJsonResponse(await api.results(), 200);
    const stats = await expectJsonResponse(await api.stats(), 200);

    expectResultRows(results);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      url: 'https://bestprice.com.ua/product/current-ok',
      status: 'OK',
      reason: 'OK',
      match: true,
    });
    expect(results[1]).toMatchObject({
      status: 'FAIL',
      reason: 'PRICE_MISMATCH',
      match: false,
    });

    expectStats(stats);
    expect(stats).toMatchObject({
      total: 2,
      success: 1,
      failed: 1,
      successRate: 0.5,
      failureRate: 0.5,
      reasons: { OK: 1, PRICE_MISMATCH: 1 },
      bucketDistribution: { BUSINESS_LOGIC_FAIL: 1 },
      topFailingSteps: [{ step: 'VALIDATE_PRICE', count: 1 }],
    });
  });

  test('lists archived runs and returns an archived run contract', async ({
    request,
  }) => {
    const api = new DashboardApiClient(request);
    const runs = await expectJsonResponse(await api.runs(), 200);
    const results = await expectJsonResponse(
      await api.runResults('run-after'),
      200,
    );
    const stats = await expectJsonResponse(
      await api.runStats('run-after'),
      200,
    );

    expect(Array.isArray(runs)).toBe(true);
    expect(runs).toHaveLength(2);
    expectRecord((runs as unknown[])[0]);
    expect((runs as Array<Record<string, unknown>>)[0]).toMatchObject({
      runId: 'run-after',
      total: 2,
      ok: 2,
      failed: 0,
    });
    expectResultRows(results);
    expect(results).toHaveLength(2);
    expectStats(stats);
    expect(stats.successRate).toBe(1);
  });

  test('compares two runs and reports an improvement', async ({ request }) => {
    const api = new DashboardApiClient(request);
    const comparison = await expectJsonResponse(
      await api.compare('run-before', 'run-after'),
      200,
    );

    expectRecord(comparison);
    expect(comparison.runA).toBe('run-before');
    expect(comparison.runB).toBe('run-after');
    expectRecord(comparison.diff);
    expect(comparison.diff).toMatchObject({
      improved: 1,
      regressed: 0,
      unchanged: 1,
      regressionRate: 0,
      stabilityDelta: 0.5,
    });
    expectRecord(comparison.reasonTrends);
    expectRecord(comparison.reasonTrends.all);
    expect(comparison.reasonTrends.all).toMatchObject({
      PRICE_MISMATCH: { before: 1, after: 0, delta: -1 },
    });
  });

  test('returns empty data for a valid unknown run ID', async ({ request }) => {
    const api = new DashboardApiClient(request);
    const results = await expectJsonResponse(
      await api.runResults('unknown-run'),
      200,
    );
    const stats = await expectJsonResponse(
      await api.runStats('unknown-run'),
      200,
    );

    expectResultRows(results);
    expect(results).toEqual([]);
    expectStats(stats);
    expect(stats).toMatchObject({
      total: 0,
      success: 0,
      failed: 0,
      successRate: 0,
      failureRate: 0,
    });
  });

  test('rejects malformed run IDs and incomplete comparisons', async ({
    request,
  }) => {
    const api = new DashboardApiClient(request);
    const invalidRun = await expectJsonResponse(
      await api.runResults('invalid!'),
      400,
    );
    const missingQuery = await expectJsonResponse(
      await api.compare('run-before'),
      400,
    );
    const invalidQuery = await expectJsonResponse(
      await api.compare('invalid!', 'run-after'),
      400,
    );

    expect(invalidRun).toEqual({ error: 'Invalid run ID' });
    expect(missingQuery).toEqual({
      error: 'Query params a and b (runId) are required',
    });
    expect(invalidQuery).toEqual({ error: 'Invalid run ID' });
  });

  test('reports no active run and rejects unsupported start input', async ({
    request,
  }) => {
    const api = new DashboardApiClient(request);
    const initialState = await expectJsonResponse(await api.activeRun(), 200);
    const invalidStart = await expectJsonResponse(
      await api.startRun({ env: 'test' }),
      400,
    );
    const finalState = await expectJsonResponse(await api.activeRun(), 200);

    expect(initialState).toEqual({ active: null });
    expect(invalidStart).toEqual({ error: 'env must be "stage" or "prod"' });
    expect(finalState).toEqual({ active: null });
  });
});

import type { APIRequestContext, APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';

export class DashboardApiClient {
  constructor(private readonly request: APIRequestContext) {}

  results(): Promise<APIResponse> {
    return this.request.get('/api/results');
  }

  stats(): Promise<APIResponse> {
    return this.request.get('/api/stats');
  }

  runs(): Promise<APIResponse> {
    return this.request.get('/api/runs');
  }

  runResults(runId: string): Promise<APIResponse> {
    return this.request.get(`/api/runs/${encodeURIComponent(runId)}/results`);
  }

  runStats(runId: string): Promise<APIResponse> {
    return this.request.get(`/api/runs/${encodeURIComponent(runId)}/stats`);
  }

  compare(runA?: string, runB?: string): Promise<APIResponse> {
    return this.request.get('/api/runs/compare', {
      params: {
        ...(runA === undefined ? {} : { a: runA }),
        ...(runB === undefined ? {} : { b: runB }),
      },
    });
  }

  activeRun(): Promise<APIResponse> {
    return this.request.get('/api/runs/active');
  }

  startRun(body: unknown): Promise<APIResponse> {
    return this.request.post('/api/runs/start', { data: body });
  }
}

export async function expectJsonResponse(
  response: APIResponse,
  expectedStatus: number,
): Promise<unknown> {
  const body = await response.text();
  const diagnostic = `${response.url()} returned ${response.status()}: ${body.slice(0, 500)}`;

  expect(response.status(), diagnostic).toBe(expectedStatus);
  expect(response.headers()['content-type'], diagnostic).toContain(
    'application/json',
  );

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(`Invalid JSON response: ${diagnostic}`);
  }
}

import { getAppConfig } from './appConfig';

export type TestEnvironment = 'stage' | 'prod';

export interface TestConfig {
  environment: TestEnvironment;
  baseUrl: string;
  productSlug: string;
  productUrl: string;
  retries: number;
  workers: number;
  testTimeoutMs: number;
  actionTimeoutMs: number;
  navigationTimeoutMs: number;
}

const DEFAULT_PRODUCT_SLUG = 'otvertka-49108-stal-sl5x75';

const PROFILES: Record<
  TestEnvironment,
  Pick<
    TestConfig,
    | 'retries'
    | 'workers'
    | 'testTimeoutMs'
    | 'actionTimeoutMs'
    | 'navigationTimeoutMs'
  >
> = {
  stage: {
    retries: 1,
    workers: 2,
    testTimeoutMs: 60_000,
    actionTimeoutMs: 15_000,
    navigationTimeoutMs: 45_000,
  },
  prod: {
    retries: 2,
    workers: 1,
    testTimeoutMs: 90_000,
    actionTimeoutMs: 20_000,
    navigationTimeoutMs: 60_000,
  },
};

function parseEnvironment(value: string | undefined): TestEnvironment {
  const normalized = value?.trim().toLowerCase() ?? 'stage';
  if (normalized === 'stage' || normalized === 'prod') return normalized;

  throw new Error(`TEST_ENV must be "stage" or "prod", received: ${value}`);
}

function parseProductSlug(
  value: string | undefined,
  required: boolean,
): string {
  if (!value?.trim()) {
    if (required) {
      throw new Error('TEST_PRODUCT_SLUG is required in CI');
    }
    return DEFAULT_PRODUCT_SLUG;
  }

  const slug = value.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
    throw new Error(
      'TEST_PRODUCT_SLUG must contain only letters, numbers and hyphens',
    );
  }
  return slug;
}

function parseInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  range: { min: number; max: number },
): number {
  if (value === undefined || value.trim() === '') return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < range.min || parsed > range.max) {
    throw new Error(
      `${name} must be an integer between ${range.min} and ${range.max}`,
    );
  }
  return parsed;
}

export function getTestConfig(
  env: NodeJS.ProcessEnv = process.env,
): TestConfig {
  const environment = parseEnvironment(env.TEST_ENV);
  const profile = PROFILES[environment];
  const baseUrl = getAppConfig(env).baseUrl;
  const productSlug = parseProductSlug(
    env.TEST_PRODUCT_SLUG,
    env.CI === 'true',
  );
  const navigationTimeoutMs = parseInteger(
    'PW_NAVIGATION_TIMEOUT_MS',
    env.PW_NAVIGATION_TIMEOUT_MS,
    profile.navigationTimeoutMs,
    { min: 1_000, max: 180_000 },
  );
  const testTimeoutMs = parseInteger(
    'PW_TEST_TIMEOUT_MS',
    env.PW_TEST_TIMEOUT_MS,
    profile.testTimeoutMs,
    { min: 1_000, max: 300_000 },
  );
  const actionTimeoutMs = parseInteger(
    'PW_ACTION_TIMEOUT_MS',
    env.PW_ACTION_TIMEOUT_MS,
    profile.actionTimeoutMs,
    { min: 1_000, max: 120_000 },
  );

  if (testTimeoutMs <= navigationTimeoutMs) {
    throw new Error(
      'PW_TEST_TIMEOUT_MS must be greater than PW_NAVIGATION_TIMEOUT_MS',
    );
  }

  if (actionTimeoutMs >= testTimeoutMs) {
    throw new Error(
      'PW_ACTION_TIMEOUT_MS must be less than PW_TEST_TIMEOUT_MS',
    );
  }

  return {
    environment,
    baseUrl,
    productSlug,
    productUrl: new URL(`/produkt/${productSlug}`, baseUrl).toString(),
    retries: parseInteger('PW_RETRIES', env.PW_RETRIES, profile.retries, {
      min: 0,
      max: 5,
    }),
    workers: parseInteger('PW_WORKERS', env.PW_WORKERS, profile.workers, {
      min: 1,
      max: 20,
    }),
    testTimeoutMs,
    actionTimeoutMs,
    navigationTimeoutMs,
  };
}

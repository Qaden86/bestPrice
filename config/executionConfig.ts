/**
 * Centralized crawler execution configuration
 *
 * This is the ONLY runtime configuration source.
 *
 * It controls:
 * - environment profile (stage/prod)
 * - execution mode (full/sample)
 * - sample size (for sample mode)
 * - concurrency (runtime performance tuning)
 */

export type Environment = 'stage' | 'prod';

export type ExecutionMode = 'full' | 'sample';

export interface ExecutionConfig {
  env: Environment;
  mode: ExecutionMode;

  /**
   * Used only when mode = 'sample'
   */
  sampleSize?: number;

  /**
   * Concurrent crawler workers
   */
  concurrency: number;
}

/**
 * Parse environment profile
 */
function parseEnv(): Environment {
  const env = process.env.NODE_ENV?.toLowerCase();

  return env === 'prod' ? 'prod' : 'stage';
}

/**
 * Execution mode
 */
function parseMode(): ExecutionMode {
  const mode = process.env.EXECUTION_MODE?.toLowerCase();

  return mode === 'sample' ? 'sample' : 'full';
}

/**
 * Sample size (only for sample mode)
 */
function parseSampleSize(mode: ExecutionMode): number | undefined {
  if (mode !== 'sample') return undefined;

  const raw = process.env.SAMPLE_SIZE;

  if (!raw) return 100;

  const parsed = Number(raw);

  return Number.isNaN(parsed) ? 100 : parsed;
}

/**
 * Concurrency resolution strategy
 *
 * Priority:
 * 1. ENV override (CRAWL_CONCURRENCY)
 * 2. environment defaults
 */
function parseConcurrency(env: Environment): number {
  const override = process.env.CRAWL_CONCURRENCY;

  if (override) {
    const parsed = Number(override);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  /**
   * Safe defaults per environment
   */
  if (env === 'prod') return 5;
  return 3; // stage
}

/**
 * Build runtime execution config
 */
export function getExecutionConfig(): ExecutionConfig {
  const env = parseEnv();
  const mode = parseMode();

  return {
    env,
    mode,
    sampleSize: parseSampleSize(mode),
    concurrency: parseConcurrency(env),
  };
}
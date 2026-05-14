/**
 * METRICS LAYER
 *
 * This module collects runtime statistics for the crawler.
 *
 * Used for:
 * - system observability
 * - performance tracking
 * - failure rate analysis
 */

export type Metrics = {
  total: number;
  success: number;
  failed: number;
  retries: number;
  avgDurationMs: number;
};

export function createMetrics() {
  const state = {
    total: 0,
    success: 0,
    failed: 0,
    retries: 0,
    durations: [] as number[],
  };

  return {
    incTotal() {
      state.total++;
    },

    incSuccess() {
      state.success++;
    },

    incFailed() {
      state.failed++;
    },

    incRetries() {
      state.retries++;
    },

    addDuration(ms: number) {
      state.durations.push(ms);
    },

    snapshot(): Metrics {
      const avg =
        state.durations.reduce((a, b) => a + b, 0) /
        (state.durations.length || 1);

      return {
        total: state.total,
        success: state.success,
        failed: state.failed,
        retries: state.retries,
        avgDurationMs: avg,
      };
    },
  };
}

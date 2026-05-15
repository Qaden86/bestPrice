import { CrawlResult } from '../types/CrawlResult';
import { TraceBucket } from '../types/TraceBuckets';
import { TraceInsights } from './traceInsights';

/**
 * Converts raw crawl results into system-level insights
 */
export function buildTraceInsights(
  results: CrawlResult[],
): TraceInsights {
  const total = results.length;

  const bucketDistribution: Record<string, number> = {};
  const stepCount: Record<string, number> = {};

  let success = 0;
  let cartFailures = 0;
  let missingPrices = 0;

  for (const r of results) {
    if (r.status === 'OK') success++;

    if (r.reason === 'ADD_TO_CART_FAILED') {
      cartFailures++;
    }

    if (!r.pdpPrice || !r.cartPrice) {
      missingPrices++;
    }

    for (const t of r.trace ?? []) {
      stepCount[t.step] = (stepCount[t.step] || 0) + 1;

      if (t.bucket) {
        bucketDistribution[t.bucket] =
          (bucketDistribution[t.bucket] || 0) + 1;
      }
    }
  }

  const topFailingSteps = Object.entries(stepCount)
    .map(([step, count]) => ({ step, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total,

    successRate: total ? success / total : 0,
    failureRate: total ? 1 - success / total : 0,

    bucketDistribution: bucketDistribution as Record<TraceBucket, number>,

    topFailingSteps,

    avgPricesMissingRate: total ? missingPrices / total : 0,

    cartFailureRate: total ? cartFailures / total : 0,
  };
}
import { CrawlResult } from '../types/CrawlResult';
import { TraceBucket } from '../types/TraceBuckets';

/**
 * Aggregated system health signals
 */
export type TraceInsights = {
  total: number;

  successRate: number;

  failureRate: number;

  bucketDistribution: Record<TraceBucket, number>;

  topFailingSteps: Array<{
    step: string;
    count: number;
  }>;

  avgPricesMissingRate: number;

  cartFailureRate: number;
};
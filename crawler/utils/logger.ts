import { TraceEvent } from '../types/CrawlResult';
import { TraceBucket } from '../types/TraceBuckets';
import { TraceStep } from '../types/TraceSteps';

/**
 * Structured trace logger
 *
 * Responsibility:
 * - ONLY append events
 * - NO classification logic
 * - NO business rules
 */
export function createLogger(trace: TraceEvent[]) {
  return {
    log(event: {
      step: TraceStep | string;

      status: 'INFO' | 'OK' | 'ERROR';

      message?: string;

      data?: unknown;

      bucket?: TraceBucket;
    }) {
      trace.push({
        step: event.step as TraceStep,

        status: event.status,

        message: event.message,

        data: event.data,

        bucket: event.bucket,

        ts: Date.now(),
      });
    },
  };
}
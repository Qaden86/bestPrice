/**
 * OBSERVABILITY / TRACE LAYER
 *
 * This module defines the structure of trace logs.
 *
 * It is used for:
 * - debugging crawl execution steps
 * - monitoring system behavior
 * - analyzing failures in production
 */

export type TraceEvent = {
  step: string;
  status: 'INFO' | 'OK' | 'ERROR';
  data?: any;
  ts: number;
};

export interface TraceLogger {
  log(event: TraceEvent): void;
}

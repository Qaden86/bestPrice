/**
 * STRUCTURED LOGGER
 *
 * Replaces ad-hoc console.log usage.
 *
 * Provides consistent trace events for:
 * - debugging
 * - dashboard usage
 * - production observability
 */

export type LogLevel = 'INFO' | 'OK' | 'WARN' | 'ERROR';

export function createLogger(trace: any[]) {
  return {
    log(event: {
      step: string;
      status: LogLevel;
      message?: string;
      data?: any;
    }) {
      const enriched = {
        ...event,
        ts: Date.now(),
      };

      trace.push(enriched);

      console.log(`[${event.step}]`, event.status, event.message ?? '');
    },
  };
}

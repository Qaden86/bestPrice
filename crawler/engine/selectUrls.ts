import { ExecutionConfig } from '../../config/executionConfig';

/**
 * URL selection strategy layer
 *
 * IMPORTANT:
 * - full mode returns ALL URLs
 * - sample mode returns deterministic subset
 */
export function selectUrls(urls: string[], config: ExecutionConfig): string[] {
  if (config.mode === 'full') {
    return urls;
  }

  return urls.slice(0, config.sampleSize ?? 100);
}

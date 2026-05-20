import { BrowserPool } from '../browser/browserPool';
import { crawlWorker } from '../workers/crawlWorker';
import { upsertResult, flushResults } from '../output/resultStore';
import { isShuttingDown, requestShutdown } from './shutdown';
import { CrawlReason, CrawlResult } from '../types/CrawlResult';

const MAX_ATTEMPTS = 3;

const RETRYABLE_REASONS: ReadonlySet<CrawlReason> = new Set<CrawlReason>([
  'NAVIGATION_FAILED',
  'CART_NOT_READY',
  'CRAWL_FAILED',
  'INTERNAL_ERROR',
]);

function isRetryable(result: CrawlResult): boolean {
  if (result.status === 'OK') return false;
  if (result.reason === 'SHUTDOWN') return false;
  return RETRYABLE_REASONS.has(result.reason);
}

export async function runConcurrentEngine(params: {
  urls: (string | { url: string })[];
  concurrency: number;
}): Promise<void> {
  const urls = params.urls.map((u) => (typeof u === 'string' ? u : u.url));

  const pool = new BrowserPool(params.concurrency);
  await pool.init();

  let cursor = 0;
  let completed = 0;

  const retryQueue: string[] = [];
  const attempts = new Map<string, number>();

  const getNext = (): string | null => {
    if (isShuttingDown()) return null;
    if (retryQueue.length) return retryQueue.shift()!;
    if (cursor >= urls.length) return null;
    return urls[cursor++];
  };

  const worker = async () => {
    while (!isShuttingDown()) {
      const url = getNext();
      if (!url) return;

      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);

      const result = await crawlWorker(url, pool);

      const canRetry =
        !isShuttingDown() && attempt < MAX_ATTEMPTS && isRetryable(result);

      if (canRetry) {
        console.log(
          `[RETRY] ${url} (${attempt}/${MAX_ATTEMPTS}) reason=${result.reason}`,
        );
        retryQueue.push(url);
        continue;
      }

      upsertResult(result);

      completed++;
      console.log(`[PROGRESS] ${completed}/${urls.length}`);
    }
  };

  const workers = Array.from({ length: params.concurrency }, () =>
    worker().catch((err) => {
      if (!isShuttingDown()) {
        console.error('[WORKER LOOP ERROR]', err);
      }
    }),
  );

  await Promise.all(workers);

  await flushResults();
  await pool.close();
}

export function installShutdownHandlers(): void {
  const onSignal = () => {
    if (isShuttingDown()) return;
    console.log('\n[SHUTDOWN] stopping workers…');
    requestShutdown();
  };

  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
}

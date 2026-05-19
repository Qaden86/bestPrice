import { BrowserPool } from '../browser/browserPool';
import { crawlWorker } from '../workers/crawlWorker';
import { upsertResult, flushResults } from '../output/resultStore';
import { isShuttingDown, requestShutdown } from './shutdown';

export async function runConcurrentEngine(params: {
  urls: (string | { url: string })[];
  concurrency: number;
}): Promise<void> {
  const urls = params.urls.map((u) => (typeof u === 'string' ? u : u.url));

  const pool = new BrowserPool(params.concurrency);
  await pool.init();

  let cursor = 0;
  let completed = 0;

  const getNext = (): string | null => {
    if (isShuttingDown() || cursor >= urls.length) return null;
    return urls[cursor++];
  };

  const worker = async () => {
    while (!isShuttingDown()) {
      const url = getNext();
      if (!url) return;

      const result = await crawlWorker(url, pool);
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

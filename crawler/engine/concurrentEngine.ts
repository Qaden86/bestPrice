import { BrowserPool } from '../browser/browserPool';
import { crawlWorker } from '../workers/crawlWorker';
import { upsertResult } from '../output/resultStore';

/**
 * Queue-based concurrent engine
 * - true parallelism = browser instances
 */
export async function runConcurrentEngine(params: {
  urls: (string | { url: string })[];
  concurrency: number;
}) {
  const urls = params.urls.map(u =>
    typeof u === 'string' ? u : u.url,
  );

  const pool = new BrowserPool(params.concurrency);
  await pool.init();

  let cursor = 0;
  let completed = 0;

  const getNext = () => {
    if (cursor >= urls.length) return null;
    return urls[cursor++];
  };

  const worker = async () => {
    while (true) {
      const url = getNext();
      if (!url) return;

      const result = await crawlWorker(url, pool);

      /**
       * SINGLE SOURCE OF TRUTH WRITE
       */
      upsertResult(result);

      completed++;
      console.log(`[PROGRESS] ${completed}/${urls.length}`);
    }
  };

  const workers = Array.from(
    { length: params.concurrency },
    () => worker(),
  );

  await Promise.all(workers);

  await pool.close();
}
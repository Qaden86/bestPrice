import { crawlWorker } from '../workers/crawlWorker';
import { CrawlResult } from '../types/CrawlResult';

type EngineInput = {
  urls: (string | { url: string })[];
  concurrency: number;
};

/**
 * Concurrent Engine (SAFE VERSION)
 *
 */
export async function runConcurrentEngine(
  params: EngineInput,
): Promise<CrawlResult[]> {
  const urls = params.urls.map((u) =>
    typeof u === 'string' ? u : u.url,
  );

  const results: CrawlResult[] = new Array(urls.length);

  await Promise.all(
    urls.map(async (url, index) => {
      if (!url) {
        console.log(`[Worker ${index}] INVALID URL`);
        return;
      }

      console.log(`[Worker ${index}] ${url}`);

      const result = await crawlWorker(url);

      // 🔥 SAFE WRITE (NO PUSH RACE)
      results[index] = result;
    }),
  );

  return results.filter(Boolean);
}
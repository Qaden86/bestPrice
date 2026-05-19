import fs from 'fs';

import { getSitemapUrls } from '../crawler/ingestion/sitemapFetcher';
import { isProductPage } from '../crawler/ingestion/urlFilter';
import { runConcurrentEngine } from '../crawler/engine/concurrentEngine';
import { selectUrls } from '../crawler/engine/selectUrls';

import { getExecutionConfig } from '../config/executionConfig';
import { getAppConfig } from '../config/appConfig';
import { RESULTS_PATH } from '../config/path';
import { setScreenshotsEnabled } from '../crawler/utils/screenshot';
import { flushResults } from '../crawler/output/resultStore';

async function main(): Promise<void> {
  console.log('[ENTRY] crawler started');

  fs.writeFileSync(RESULTS_PATH, '', 'utf-8');

  const runtime = getExecutionConfig();
  const app = getAppConfig();

  setScreenshotsEnabled(runtime.screenshots);

  console.log('[CONFIG]', { ...runtime, baseUrl: app.baseUrl });

  const allUrls = await getSitemapUrls(app);
  const productUrls = allUrls.filter(isProductPage);
  const urlsToProcess = selectUrls(productUrls, runtime);

  console.log('[INGESTION]', {
    total: allUrls.length,
    product: productUrls.length,
    selected: urlsToProcess.length,
  });

  await runConcurrentEngine({
    urls: urlsToProcess,
    concurrency: runtime.concurrency,
  });

  await flushResults();

  console.log('[DONE]');
}

(async () => {
  try {
    await main();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
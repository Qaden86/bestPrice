import fs from 'fs';

import { getSitemapUrls } from '../crawler/ingestion/sitemapFetcher';
import { isProductPage } from '../crawler/ingestion/urlFilter';
import {
  runConcurrentEngine,
  installShutdownHandlers,
} from '../crawler/engine/concurrentEngine';
import { selectUrls } from '../crawler/engine/selectUrls';
import { isShuttingDown } from '../crawler/engine/shutdown';

import { getExecutionConfig } from '../config/executionConfig';
import { getAppConfig } from '../config/appConfig';
import { RESULTS_PATH } from '../config/path';
import { setScreenshotsEnabled } from '../crawler/utils/screenshot';
import { flushResults } from '../crawler/output/resultStore';
import { loadCompletedUrlSet } from '../crawler/output/resume';
import {
  archiveCurrentRunIfAny,
  ensureRunsDir,
  writeRunManifest,
} from '../crawler/output/runArchive';

async function main(): Promise<void> {
  console.log('[ENTRY] crawler started');

  const resume = process.env.CRAWL_RESUME === 'true';

  ensureRunsDir();

  if (!resume) {
    const archived = archiveCurrentRunIfAny();
    if (archived) {
      console.log('[ARCHIVE] previous run saved as', archived);
    }
    fs.writeFileSync(RESULTS_PATH, '', 'utf-8');
  } else {
    console.log('[RESUME] continuing from existing', RESULTS_PATH);
  }

  const startedAt = new Date().toISOString();
  const runId = startedAt.replace(/[:.]/g, '-');

  installShutdownHandlers();

  const runtime = getExecutionConfig();
  const app = getAppConfig();

  setScreenshotsEnabled(runtime.screenshots);

  console.log('[CONFIG]', {
    ...runtime,
    baseUrl: app.baseUrl,
    runId,
    resume,
    contextReuse: true,
    blockAssets: ['image', 'font', 'media'],
  });

  const allUrls = await getSitemapUrls(app);
  const productUrls = allUrls.filter(isProductPage).map((item) => item.url);
  let urlsToProcess = selectUrls(productUrls, runtime);

  if (resume) {
    const completed = loadCompletedUrlSet(RESULTS_PATH);
    const before = urlsToProcess.length;
    urlsToProcess = urlsToProcess.filter((url) => !completed.has(url));
    console.log('[RESUME]', {
      alreadyDone: before - urlsToProcess.length,
      remaining: urlsToProcess.length,
    });
  }

  console.log('[INGESTION]', {
    total: allUrls.length,
    product: productUrls.length,
    selected: urlsToProcess.length,
  });

  if (urlsToProcess.length === 0) {
    console.log('[DONE] nothing to crawl');
    return;
  }

  await runConcurrentEngine({
    urls: urlsToProcess,
    concurrency: runtime.concurrency,
  });

  await flushResults();

  if (!isShuttingDown()) {
    writeRunManifest(runId, startedAt);
    console.log('[DONE]', { runId });
  } else {
    console.log('[DONE] interrupted — partial results in', RESULTS_PATH);
  }
}

(async () => {
  try {
    await main();
    process.exit(isShuttingDown() ? 130 : 0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

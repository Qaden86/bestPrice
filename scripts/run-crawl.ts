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
import {
  archiveCurrentRunIfAny,
  ensureRunsDir,
  writeRunManifest,
} from '../crawler/output/runArchive';

async function main(): Promise<void> {
  console.log('[ENTRY] crawler started');

  ensureRunsDir();
  const archived = archiveCurrentRunIfAny();
  if (archived) {
    console.log('[ARCHIVE] previous run saved as', archived);
  }

  fs.writeFileSync(RESULTS_PATH, '', 'utf-8');

  const startedAt = new Date().toISOString();
  const runId = startedAt.replace(/[:.]/g, '-');

  installShutdownHandlers();

  const runtime = getExecutionConfig();
  const app = getAppConfig();

  setScreenshotsEnabled(runtime.screenshots);

  console.log('[CONFIG]', { ...runtime, baseUrl: app.baseUrl, runId });

  const allUrls = await getSitemapUrls(app);
  const productUrls = allUrls.filter(isProductPage).map((item) => item.url);
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

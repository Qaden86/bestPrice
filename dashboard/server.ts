import express from 'express';
import path from 'path';

import { loadResults, loadResultsFromFile } from './loadResults';
import { resultBus } from '../crawler/output/resultStore';
import { listArchivedRuns } from '../crawler/output/runArchive';
import { DATA_DIR, RUNS_DIR } from '../config/path';

const app = express();
const PORT = 3000;

const UI_PATH = path.resolve(__dirname, '../dashboard-ui');
const INDEX_HTML = path.resolve(UI_PATH, 'index.html');

app.use(express.static(UI_PATH));
app.use('/data', express.static(DATA_DIR));

app.get('/api/results', (_req, res) => {
  res.json(normalizeRows(loadResults()));
});

app.get('/api/stats', (_req, res) => {
  res.json(statsFromRows(loadResults()));
});

app.get('/api/runs', (_req, res) => {
  res.json(listArchivedRuns());
});

app.get('/api/runs/:runId/results', (req, res) => {
  const filePath = path.join(RUNS_DIR, req.params.runId, 'results.ndjson');
  res.json(normalizeRows(loadResultsFromFile(filePath)));
});

app.get('/api/runs/:runId/stats', (req, res) => {
  const filePath = path.join(RUNS_DIR, req.params.runId, 'results.ndjson');
  res.json(statsFromRows(loadResultsFromFile(filePath)));
});

app.get('/api/runs/compare', (req, res) => {
  const a = String(req.query.a ?? '');
  const b = String(req.query.b ?? '');

  if (!a || !b) {
    res.status(400).json({ error: 'Query params a and b (runId) are required' });
    return;
  }

  const rowsA =
    a === 'current'
      ? loadResults()
      : loadResultsFromFile(path.join(RUNS_DIR, a, 'results.ndjson'));
  const rowsB =
    b === 'current'
      ? loadResults()
      : loadResultsFromFile(path.join(RUNS_DIR, b, 'results.ndjson'));

  const mapA = new Map(rowsA.map((r) => [getUrl(r), r]));
  const mapB = new Map(rowsB.map((r) => [getUrl(r), r]));

  let improved = 0;
  let regressed = 0;
  let unchanged = 0;

  for (const [url, ra] of mapA) {
    const rb = mapB.get(url);
    if (!rb) continue;

    const okA = ra.status === 'OK' && ra.match;
    const okB = rb.status === 'OK' && rb.match;

    if (!okA && okB) improved++;
    else if (okA && !okB) regressed++;
    else unchanged++;
  }

  const statsA = statsFromRows(rowsA);
  const statsB = statsFromRows(rowsB);

  const reasonTrends = buildReasonTrends(statsA.reasons, statsB.reasons);

  res.json({
    runA: a,
    runB: b,
    statsA,
    statsB,
    diff: {
      improved,
      regressed,
      unchanged,
      regressionRate: rowsB.length
        ? regressed / rowsB.length
        : 0,
      stabilityDelta:
        (statsB.successRate ?? 0) - (statsA.successRate ?? 0),
    },
    reasonTrends,
  });
});

app.get('/api/results-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  for (const item of loadResults()) {
    res.write(`data: ${JSON.stringify(item)}\n\n`);
  }

  const listener = (result: unknown) => {
    res.write(`data: ${JSON.stringify(result)}\n\n`);
  };

  resultBus.on('update', listener);
  req.on('close', () => {
    resultBus.off('update', listener);
    res.end();
  });
});

app.use((_req, res) => {
  res.sendFile(INDEX_HTML);
});

app.listen(PORT, () => {
  console.log(`Dashboard: http://localhost:${PORT}`);
});

function getUrl(r: { url?: unknown }): string {
  if (typeof r.url === 'string') return r.url;
  if (r.url && typeof r.url === 'object' && 'url' in r.url) {
    return String((r.url as { url: string }).url);
  }
  return 'unknown';
}

function normalizeRows(results: any[]) {
  return results.map((r) => ({
    url: getUrl(r),
    status: r.status ?? 'FAIL',
    reason: r.reason ?? 'UNKNOWN',
    selector: r.selector ?? null,
    detail: r.detail ?? null,
    pdpPrice: r.pdpPrice ?? null,
    cartPrice: r.cartPrice ?? null,
    match: !!r.match,
    screenshot: r.screenshot ?? null,
  }));
}

function buildReasonTrends(
  reasonsA: Record<string, number>,
  reasonsB: Record<string, number>,
) {
  const keys = new Set([...Object.keys(reasonsA), ...Object.keys(reasonsB)]);

  const trends: Record<
    string,
    { before: number; after: number; delta: number }
  > = {};

  for (const key of keys) {
    const before = reasonsA[key] ?? 0;
    const after = reasonsB[key] ?? 0;
    trends[key] = { before, after, delta: after - before };
  }

  return {
    selectorNotFound: trends.SELECTOR_NOT_FOUND ?? {
      before: 0,
      after: 0,
      delta: 0,
    },
    missingPrice: trends.MISSING_PRICE ?? { before: 0, after: 0, delta: 0 },
    priceMismatch: trends.PRICE_MISMATCH ?? { before: 0, after: 0, delta: 0 },
    priceIsZero: trends.PRICE_IS_ZERO ?? { before: 0, after: 0, delta: 0 },
    all: trends,
  };
}

function statsFromRows(results: any[]) {
  const total = results.length;
  const success = results.filter((r) => r.status === 'OK' && r.match).length;
  const failed = total - success;
  const reasons: Record<string, number> = {};

  for (const r of results) {
    const key = r.reason ?? 'UNKNOWN';
    reasons[key] = (reasons[key] ?? 0) + 1;
  }

  return {
    total,
    success,
    failed,
    successRate: total ? success / total : 0,
    failureRate: total ? failed / total : 0,
    reasons,
  };
}

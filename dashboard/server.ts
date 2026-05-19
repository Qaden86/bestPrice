import express from 'express';
import path from 'path';

import { loadResults } from './loadResults';

import {
  resultBus,
} from '../crawler/output/resultStore';

const app = express();
const PORT = 3000;

const UI_PATH = path.resolve(
  __dirname,
  '../dashboard-ui',
);

const INDEX_HTML = path.resolve(
  UI_PATH,
  'index.html',
);

app.use(express.static(UI_PATH));

/**
 * Snapshot API
 */
app.get('/api/results', (req, res) => {
  const results = loadResults();

  res.json(
    results.map((r) => ({
      url:
        typeof r.url === 'object'
          ? r.url.url
          : r.url,

      status: r.status ?? 'ERROR',
      reason: r.reason ?? 'UNKNOWN',

      pdpPrice: r.pdpPrice ?? null,
      cartPrice: r.cartPrice ?? null,

      match: !!r.match,

      trace: Array.isArray(r.trace)
        ? r.trace
        : [],
    })),
  );
});

/**
 * Stats API
 */
app.get('/api/stats', (req, res) => {
  const results = loadResults();

  const total = results.length;

  const success = results.filter(
    (r) => r.status === 'OK' && r.match,
  ).length;

  const failed = total - success;

  res.json({
    total,
    successRate: total
      ? success / total
      : 0,

    failureRate: total
      ? failed / total
      : 0,
  });
});

/**
 * SSE realtime stream
 */
app.get('/api/results-stream', (req, res) => {
  res.setHeader(
    'Content-Type',
    'text/event-stream',
  );

  res.setHeader(
    'Cache-Control',
    'no-cache',
  );

  res.setHeader(
    'Connection',
    'keep-alive',
  );

  /**
   * Send initial snapshot
   */
  const snapshot = loadResults();

  for (const item of snapshot) {
    res.write(
      `data: ${JSON.stringify(item)}\n\n`,
    );
  }

  /**
   * Realtime updates
   */
  const listener = (result: any) => {
    res.write(
      `data: ${JSON.stringify(result)}\n\n`,
    );
  };

  resultBus.on('update', listener);

  req.on('close', () => {
    resultBus.off('update', listener);
    res.end();
  });
});

/**
 * SPA fallback
 */
app.use((req, res) => {
  res.sendFile(INDEX_HTML);
});

app.listen(PORT, () => {
  console.log(
    `Dashboard: http://localhost:${PORT}`,
  );
});
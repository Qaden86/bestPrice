import express from 'express';
import path from 'path';

import { loadResults } from './loadResults';
import { parsePrice } from '../crawler/utils/parsePrice';
import { buildTraceInsights } from '../crawler/observability/buildTraceInsights';

const app = express();
const PORT = 3000;

const UI_PATH = path.resolve(__dirname, '../dashboard-ui');

const INDEX_HTML = path.resolve(UI_PATH, 'index.html');

app.use(express.static(UI_PATH));

/**
 * API: results
 */
app.get('/api/results', (req, res) => {
  const results = loadResults();

  const enriched = results.map((r) => {
    const pdp = parsePrice(r.pdpPrice);

    const cart = parsePrice(r.cartPrice);

    return {
      url: typeof r.url === 'string' ? r.url : 'unknown',

      status: r.status,
      reason: r.reason,

      pdp,
      cart,

      match: r.match === true,

      //debug trace for modal
      trace: r.trace ?? [],
    };
  });

  res.json(enriched);
});

/**
 * API: stats
 */
app.get('/api/stats', (req, res) => {
  const results = loadResults();

  const insights = buildTraceInsights(results);

  res.json({
    total: insights.total,
    successRate: insights.successRate,
    failureRate: insights.failureRate,

    bucketDistribution: insights.bucketDistribution,
    topFailingSteps: insights.topFailingSteps,
    cartFailureRate: insights.cartFailureRate,
  });
});

/**
 * SPA fallback
 */
app.use((req, res) => {
  res.sendFile(INDEX_HTML);
});

app.listen(PORT, () => {
  console.log(`Dashboard: http://localhost:${PORT}`);
});

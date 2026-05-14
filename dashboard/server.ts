/**
 * DASHBOARD SERVER
 *
 * - Express API
 * - Safe SPA fallback
 * - Static UI hosting
 */

import express from 'express';
import path from 'path';
import { loadResults } from './loadResults';

const app = express();
const PORT = 3000;

/**
 * Paths
 */
const UI_PATH = path.resolve(__dirname, '../dashboard-ui');
const INDEX_HTML = path.resolve(UI_PATH, 'index.html');

/**
 * Serve static UI
 */
app.use(express.static(UI_PATH));

/**
 * API: results
 */
app.get('/api/results', (req, res) => {
  const results = loadResults();

  const enriched = results.map((r) => ({
    status: r.match ? 'OK' : 'FAIL',
    url: r.url,

    pdp: r.pdpPrice ?? 'N/A',
    cart: r.cartPrice ?? 'N/A',

    match: r.match ? '✅' : '❌',
    reason: r.reason ?? 'OK',
  }));

  res.json(enriched);
});

/**
 * API: stats
 */
app.get('/api/stats', (req, res) => {
  const results = loadResults();

  const total = results.length;
  const success = results.filter((r) => r.match).length;
  const failed = total - success;

  res.json({
    total,
    success,
    failed,
  });
});

/**
 * SPA fallback
 */
app.use((req, res) => {
  res.sendFile(INDEX_HTML);
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`Dashboard: http://localhost:${PORT}`);
});

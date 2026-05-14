/**
 * Dashboard UI v2+
 * - live refresh
 * - filters (search/min/max)
 * - status badges
 * - price mismatch highlight
 */

let ALL_ROWS = [];

/**
 * Initial load
 */
async function load() {
  const [resultsRes, statsRes] = await Promise.all([
    fetch('/api/results'),
    fetch('/api/stats'),
  ]);

  const results = await resultsRes.json();
  const stats = await statsRes.json();

  ALL_ROWS = results;

  renderStats(stats);
  applyFilters();
}

/**
 * Stats render
 */
function renderStats(stats) {
  document.getElementById('stats').innerHTML =
    `Total: ${stats.total} | Success: ${stats.success} | Failed: ${stats.failed}`;
}

/**
 * Filters engine
 */
function applyFilters() {
  const search = document.getElementById('search')?.value?.toLowerCase() || '';

  const min = Number(document.getElementById('minPrice')?.value || 0);
  const max = Number(document.getElementById('maxPrice')?.value || 999999);

  const filtered = ALL_ROWS.filter((r) => {
    const urlMatch = (r.url || '').toLowerCase().includes(search);

    const price = Number(r.pdp || 0);

    const priceMatch = price >= min && price <= max;

    return urlMatch && priceMatch;
  });

  renderTable(filtered);
}

/**
 * Table renderer
 */
function renderTable(rows) {
  const container = document.getElementById('table');

  container.innerHTML = rows
    .map((r) => {
      const isOk = r.status === 'OK' || r.match === '✅';

      const pdp = Number(r.pdp || 0);
      const cart = Number(r.cart || 0);

      const priceDiff = pdp !== cart;

      return `
        <tr class="${isOk ? 'row-ok' : 'row-fail'} ${priceDiff ? 'row-diff' : ''}">
          <td>
            <span class="badge ${isOk ? 'ok' : 'fail'}">
              ${isOk ? 'OK' : 'FAIL'}
            </span>
          </td>

          <td class="url">${r.url}</td>

          <td>${r.pdp}</td>
          <td>${r.cart}</td>

          <td>${r.match}</td>
          <td>${r.reason}</td>
        </tr>
      `;
    })
    .join('');
}

/**
 * Bind events + auto refresh
 */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('search')?.addEventListener('input', applyFilters);
  document.getElementById('minPrice')?.addEventListener('input', applyFilters);
  document.getElementById('maxPrice')?.addEventListener('input', applyFilters);

  load();

  // live refresh every 2 seconds
  setInterval(load, 2000);
});

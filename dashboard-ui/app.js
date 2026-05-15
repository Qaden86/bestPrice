/**
 * Dashboard UI
 * - stable row registry (no JSON.stringify loss)
 * - trace inspector modal
 * - clean filtering
 */

let ALL_ROWS = [];
window.__ROWS_MAP = {};

/**
 * Load data from API
 */
async function load() {
  try {
    const [resultsRes, statsRes] = await Promise.all([
      fetch('/api/results'),
      fetch('/api/stats'),
    ]);

    ALL_ROWS = await resultsRes.json();
    const stats = await statsRes.json();

    /**
     * Build stable lookup map for modal usage
     */
    window.__ROWS_MAP = {};
    ALL_ROWS.forEach((r) => {
      window.__ROWS_MAP[r.url] = r;
    });

    renderStats(stats);
    applyFilters();
  } catch (e) {
    console.error('[DASHBOARD] load failed:', e);
  }
}

/**
 * Stats renderer
 */
function renderStats(stats) {
  document.getElementById('stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-title">TOTAL</div>
      <div class="stat-value">${stats.total}</div>
    </div>

    <div class="stat-card success">
      <div class="stat-title">SUCCESS RATE</div>
      <div class="stat-value">${(stats.successRate * 100).toFixed(1)}%</div>
    </div>

    <div class="stat-card failed">
      <div class="stat-title">FAIL RATE</div>
      <div class="stat-value">${(stats.failureRate * 100).toFixed(1)}%</div>
    </div>

    <div class="stat-card">
      <div class="stat-title">CART FAIL RATE</div>
      <div class="stat-value">${(stats.cartFailureRate * 100).toFixed(1)}%</div>
    </div>
  `;
}

/**
 * Filters
 */
function applyFilters() {
  const search = document.getElementById('search')?.value?.toLowerCase() || '';

  const status = document.getElementById('statusFilter')?.value || '';

  let rows = [...ALL_ROWS];

  if (search) {
    rows = rows.filter((r) => (r.url || '').toLowerCase().includes(search));
  }

  if (status) {
    rows = rows.filter((r) => r.status === status);
  }

  renderTable(rows);
}

/**
 * Badge renderer
 */
function getBadge(status) {
  if (status === 'OK') {
    return `<span class="badge badge-ok">OK</span>`;
  }

  return `<span class="badge badge-error">ERROR</span>`;
}

/**
 * Open trace safely
 */
function openTraceByUrl(url) {
  const row = window.__ROWS_MAP[url];

  if (!row) {
    console.warn('[TRACE] Row not found:', url);
    return;
  }

  openTrace(row);
}

/**
 * Close modal
 */
function closeTrace() {
  document.getElementById('traceModal').style.display = 'none';
}

/**
 * Trace modal renderer
 */
function openTrace(row) {
  const trace = Array.isArray(row.trace) ? row.trace : [];

  const pdp = row.pdp?.value ?? '-';
  const cart = row.cart?.value ?? '-';

  const diff =
    row.pdp?.status === 'OK' && row.cart?.status === 'OK'
      ? row.pdp.value - row.cart.value
      : '-';

  const traceHtml = trace
    .map(
      (t) => `
    <div class="trace-item">

      <div class="trace-step">
        ${t.step}
      </div>

      <div class="trace-status">
        ${t.status}
      </div>

      <div class="trace-time">
        ${t.ts || '-'}
      </div>

      ${t.message ? `<div class="trace-msg">${t.message}</div>` : ''}

      ${
        t.data !== undefined
          ? `<div class="trace-data">${JSON.stringify(t.data)}</div>`
          : ''
      }

    </div>
  `,
    )
    .join('');

  document.getElementById('traceModal').innerHTML = `
    <div class="modal-backdrop" onclick="closeTrace()"></div>

    <div class="modal">

      <!-- HEADER -->
      <div class="modal-header">
        <div class="modal-title">TRACE INSPECTOR</div>
        <button onclick="closeTrace()">Close</button>
      </div>

      <!-- URL -->
      <div class="modal-url">
        ${row.url}
      </div>

      <!-- SUMMARY -->
      <div class="modal-summary">

        <div><b>Status:</b> ${row.status}</div>
        <div><b>Reason:</b> ${row.reason || '-'}</div>

        <hr />

        <div><b>PDP:</b> ${pdp}</div>
        <div><b>Cart:</b> ${cart}</div>
        <div><b>Diff:</b> ${diff}</div>

      </div>

      <hr />

      <!-- TRACE -->
      <div class="trace-body">
        ${traceHtml}
      </div>

    </div>
  `;

  document.getElementById('traceModal').style.display = 'block';
}

/**
 * Table renderer
 */
function renderTable(rows) {
  const table = document.getElementById('table');

  if (!rows.length) {
    table.innerHTML = `
      <tr>
        <td colspan="6">No results</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = rows
    .map((r) => {
      const pdp = r.pdp?.value ?? '-';
      const cart = r.cart?.value ?? '-';

      const diff =
        r.pdp?.status === 'OK' && r.cart?.status === 'OK'
          ? Math.abs(r.pdp.value - r.cart.value)
          : '-';

      const rowClass = r.status === 'OK' ? 'row-ok' : 'row-fail';

      return `
      <tr class="${rowClass}">

        <td>${getBadge(r.status)}</td>

        <td class="url">
          <div class="url-actions">

            <a
              class="open-btn"
              href="${r.url}"
              target="_blank"
            >
              OPEN
            </a>

            <button
              class="copy-btn"
              onclick="navigator.clipboard.writeText('${r.url}')"
            >
              COPY
            </button>

            <button
              class="copy-btn"
              onclick="openTraceByUrl('${r.url}')"
            >
              TRACE
            </button>

          </div>
        </td>

        <td>${pdp}</td>
        <td>${cart}</td>
        <td>${diff}</td>
        <td>${r.reason || '-'}</td>

      </tr>
    `;
    })
    .join('');
}

/**
 * Events
 */
document.getElementById('search')?.addEventListener('input', applyFilters);

document
  .getElementById('statusFilter')
  ?.addEventListener('change', applyFilters);

/**
 * Init
 */
load();

/**
 * Live refresh
 */
setInterval(load, 2000);

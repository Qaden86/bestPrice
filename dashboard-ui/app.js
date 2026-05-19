/**
 * Dashboard UI
 * Responsibilities:
 * - render crawler results
 * - maintain in-memory state
 * - support snapshot + SSE stream
 * - stable URL mapping (fix object URL bug)
 */

let ALL_ROWS = [];
window.__ROWS_MAP = {};

/**
 * Normalize URL into strict string.
 * Prevents "object URL" bugs from backend.
 */
function getSafeUrl(r) {
  if (!r?.url) return 'unknown';

  if (typeof r.url === 'string') return r.url;

  if (typeof r.url === 'object') return r.url.url || 'unknown';

  return 'unknown';
}

/**
 * Register row in lookup map (used for TRACE modal)
 */
function registerRow(r) {
  const key = getSafeUrl(r);
  window.__ROWS_MAP[key] = r;
}

/**
 * Populate reason filter dynamically
 */
function renderReasonFilter() {
  const select = document.getElementById('reasonFilter');

  if (!select) return;

  const currentValue = select.value;

  const reasons = [
    ...new Set(
      ALL_ROWS
        .map((r) => r.reason)
        .filter(Boolean),
    ),
  ].sort();

  select.innerHTML = `
    <option value="">All reasons</option>
    ${reasons
      .map((reason) => `<option value="${reason}">${reason}</option>`)
      .join('')}
  `;

  select.value = currentValue;
}

/**
 * Snapshot load (initial page load)
 */
async function loadSnapshot() {
  try {
    const res = await fetch('/api/results');
    ALL_ROWS = await res.json();

    window.__ROWS_MAP = {};

    ALL_ROWS.forEach((r) => registerRow(r));

    renderStatsFromRows();
    renderReasonFilter();
    applyFilters();
  } catch (e) {
    console.error('[SNAPSHOT LOAD FAILED]', e);
  }
}

/**
 * SSE STREAM (live updates)
 */
function initStream() {
  const eventSource = new EventSource('/api/results-stream');

  eventSource.onmessage = (event) => {
    try {
      const row = JSON.parse(event.data);

      const safeUrl = getSafeUrl(row);

      const existingIndex = ALL_ROWS.findIndex(
        (r) => getSafeUrl(r) === safeUrl,
      );

      if (existingIndex >= 0) {
        ALL_ROWS[existingIndex] = row;
      } else {
        ALL_ROWS.push(row);
      }

      registerRow(row);

      renderStatsFromRows();
      renderReasonFilter();
      applyFilters();
    } catch (e) {
      console.warn('[STREAM PARSE ERROR]', e);
    }
  };

  eventSource.onerror = (err) => {
    console.error('[STREAM ERROR]', err);
  };
}

/**
 * STATS (computed locally)
 */
function renderStatsFromRows() {
  const total = ALL_ROWS.length;

  const success = ALL_ROWS.filter(
    (r) => r.status === 'OK' && r.match,
  ).length;

  const failed = total - success;

  const cartFailures = ALL_ROWS.filter(
    (r) =>
      r.reason === 'ADD_TO_CART_FAILED' ||
      r.cartPrice == null,
  ).length;

  document.getElementById('stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-title">TOTAL</div>
      <div class="stat-value">${total}</div>
    </div>

    <div class="stat-card success">
      <div class="stat-title">SUCCESS RATE</div>
      <div class="stat-value">
        ${total ? ((success / total) * 100).toFixed(1) : 0}%
      </div>
    </div>

    <div class="stat-card failed">
      <div class="stat-title">FAIL RATE</div>
      <div class="stat-value">
        ${total ? ((failed / total) * 100).toFixed(1) : 0}%
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-title">CART FAIL RATE</div>
      <div class="stat-value">
        ${total ? ((cartFailures / total) * 100).toFixed(1) : 0}%
      </div>
    </div>
  `;
}

/**
 * FILTERS
 */
function applyFilters() {
  const search =
    document.getElementById('search')?.value?.toLowerCase() || '';

  const status =
    document.getElementById('statusFilter')?.value || '';

  const reason =
    document.getElementById('reasonFilter')?.value || '';

  let rows = [...ALL_ROWS];

  if (search) {
    rows = rows.filter((r) =>
      (getSafeUrl(r) || '').toLowerCase().includes(search),
    );
  }

  if (status) {
    rows = rows.filter((r) => r.status === status);
  }

  if (reason) {
    rows = rows.filter((r) => r.reason === reason);
  }

  renderTable(rows);
}

/**
 * TRACE MODAL
 */
function openTrace(row) {
  const trace = Array.isArray(row.trace) ? row.trace : [];

  const url = getSafeUrl(row);

  const pdp = row.pdpPrice ?? '-';
  const cart = row.cartPrice ?? '-';

  const diff =
    row.pdpPrice != null && row.cartPrice != null
      ? Math.abs(row.pdpPrice - row.cartPrice)
      : '-';

  const traceHtml = trace
    .map(
      (t) => `
    <div class="trace-item">
      <div><b>${t.step}</b></div>
      <div>${t.status}</div>
      <div>${t.ts || '-'}</div>
      ${t.message ? `<div>${JSON.stringify(t.message)}</div>` : ''}
      ${t.data ? `<pre>${JSON.stringify(t.data, null, 2)}</pre>` : ''}
    </div>
  `,
    )
    .join('');

  document.getElementById('traceModal').innerHTML = `
    <div class="modal-backdrop" onclick="closeTrace()"></div>

    <div class="modal">
      <div class="modal-header">
        <div>TRACE</div>
        <button onclick="closeTrace()">Close</button>
      </div>

      <div class="modal-url">${url}</div>

      <div>
        <b>Status:</b> ${row.status}<br/>
        <b>Reason:</b> ${row.reason}<br/>
        <b>PDP:</b> ${pdp}<br/>
        <b>Cart:</b> ${cart}<br/>
        <b>Diff:</b> ${diff}
      </div>

      <hr/>

      ${traceHtml}
    </div>
  `;

  document.getElementById('traceModal').style.display = 'block';
}

function openTraceByUrl(url) {
  const row = window.__ROWS_MAP[url];

  if (!row) {
    console.warn('[TRACE] not found:', url);
    return;
  }

  openTrace(row);
}

function closeTrace() {
  document.getElementById('traceModal').style.display = 'none';
}

/**
 * TABLE RENDERER
 */
function renderTable(rows) {
  const table = document.getElementById('table');

  if (!rows.length) {
    table.innerHTML = `<tr><td colspan="6">No results</td></tr>`;
    return;
  }

  table.innerHTML = rows
    .map((r) => {
      const url = getSafeUrl(r);

      const pdp = r.pdpPrice ?? '-';
      const cart = r.cartPrice ?? '-';

      const diff =
        r.pdpPrice != null && r.cartPrice != null
          ? Math.abs(r.pdpPrice - r.cartPrice)
          : '-';

      const rowClass = r.status === 'OK' ? 'row-ok' : 'row-fail';

      return `
      <tr class="${rowClass}">
        <td>${r.status}</td>

        <td>
          <div style="display:flex; gap:8px; align-items:center;">
            <button onclick="window.open('${url}', '_blank')">OPEN</button>
            <button onclick="navigator.clipboard.writeText('${url}')">COPY</button>
            <button onclick="openTraceByUrl('${url}')">TRACE</button>
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
 * EVENTS
 */
document
  .getElementById('search')
  ?.addEventListener('input', applyFilters);

document
  .getElementById('statusFilter')
  ?.addEventListener('change', applyFilters);

document
  .getElementById('reasonFilter')
  ?.addEventListener('change', applyFilters);

/**
 * INIT
 */
loadSnapshot();
initStream();
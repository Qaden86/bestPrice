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

let CURRENT_PAGE = 1;
let PAGE_SIZE = 25;
let FILTERED_ROWS = [];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

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
    ...new Set(ALL_ROWS.map((r) => r.reason).filter(Boolean)),
  ].sort();

  select.innerHTML = `
    <option value="">All reasons</option>
    ${reasons
      .map(
        (reason) =>
          `<option value="${escapeHtml(reason)}">${escapeHtml(reason)}</option>`,
      )
      .join('')}
  `;

  select.value = currentValue;
}

let ARCHIVED_RUNS = [];
let ACTIVE_RUN = 'current';

async function loadRunsList() {
  try {
    const res = await fetch('/api/runs');
    ARCHIVED_RUNS = await res.json();

    const runSelect = document.getElementById('runSelect');
    const compareSelect = document.getElementById('compareRunSelect');

    if (!runSelect || !compareSelect) return;

    runSelect.innerHTML =
      '<option value="current">Current run</option>' +
      ARCHIVED_RUNS.map(
        (r) =>
          `<option value="${escapeHtml(r.runId)}">${escapeHtml(r.finishedAt.slice(0, 19))} — OK ${r.ok}/${r.total}</option>`,
      ).join('');

    compareSelect.innerHTML =
      '<option value="">Compare with…</option>' +
      ARCHIVED_RUNS.map(
        (r) =>
          `<option value="${escapeHtml(r.runId)}">${escapeHtml(r.finishedAt.slice(0, 19))}</option>`,
      ).join('');
  } catch (e) {
    console.warn('[RUNS LIST]', e);
  }
}

async function loadCompareBanner() {
  const compareId = document.getElementById('compareRunSelect')?.value;
  const banner = document.getElementById('compareBanner');

  if (!compareId || !banner) {
    if (banner) banner.style.display = 'none';
    return;
  }

  const baseline = ACTIVE_RUN === 'current' ? 'current' : ACTIVE_RUN;

  const res = await fetch(
    `/api/runs/compare?a=${encodeURIComponent(compareId)}&b=${encodeURIComponent(baseline)}`,
  );
  const data = await res.json();

  const sel = data.reasonTrends?.selectorNotFound;
  const mis = data.reasonTrends?.priceMismatch;
  const stab = (data.diff?.stabilityDelta ?? 0) * 100;

  banner.style.display = 'block';
  banner.innerHTML = `
    <strong>Compare</strong> ${escapeHtml(compareId)} → ${escapeHtml(baseline)} |
    improved ${data.diff.improved}, regressed ${data.diff.regressed} |
    success rate Δ ${stab >= 0 ? '+' : ''}${stab.toFixed(1)}% |
    SELECTOR_NOT_FOUND Δ ${sel?.delta ?? 0} |
    PRICE_MISMATCH Δ ${mis?.delta ?? 0}
  `;
}

async function loadSnapshot() {
  try {
    const endpoint =
      ACTIVE_RUN === 'current'
        ? '/api/results'
        : `/api/runs/${encodeURIComponent(ACTIVE_RUN)}/results`;

    const res = await fetch(endpoint);
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
      applyFilters(true);
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

  const success = ALL_ROWS.filter((r) => r.status === 'OK' && r.match).length;

  const failed = total - success;

  const cartFailures = ALL_ROWS.filter(
    (r) => r.reason === 'ADD_TO_CART_FAILED' || r.cartPrice == null,
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

  renderInsightsFromRows();
}

/**
 * INSIGHTS — top failing steps + trace bucket distribution.
 *
 * Recovered from the deleted buildTraceInsights helper:
 * counts trace events with status === 'ERROR', groups by step and bucket.
 */
function renderInsightsFromRows() {
  const target = document.getElementById('insights');
  if (!target) return;

  const stepCount = {};
  const bucketCount = {};

  for (const r of ALL_ROWS) {
    const trace = Array.isArray(r.trace) ? r.trace : [];
    for (const ev of trace) {
      if (ev?.status !== 'ERROR') continue;
      if (ev.step) stepCount[ev.step] = (stepCount[ev.step] ?? 0) + 1;
      if (ev.bucket) bucketCount[ev.bucket] = (bucketCount[ev.bucket] ?? 0) + 1;
    }
  }

  const topSteps = Object.entries(stepCount)
    .map(([step, count]) => ({ step, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const buckets = Object.entries(bucketCount)
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => b.count - a.count);

  if (!topSteps.length && !buckets.length) {
    target.innerHTML = '';
    return;
  }

  const stepsHtml = topSteps.length
    ? topSteps
        .map(
          (s) =>
            `<li><span class="insight-key">${escapeHtml(s.step)}</span><span class="insight-val">${s.count}</span></li>`,
        )
        .join('')
    : '<li class="insight-empty">No failing steps</li>';

  const bucketsHtml = buckets.length
    ? buckets
        .map(
          (b) =>
            `<li><span class="insight-key">${escapeHtml(b.bucket)}</span><span class="insight-val">${b.count}</span></li>`,
        )
        .join('')
    : '<li class="insight-empty">No buckets</li>';

  target.innerHTML = `
    <div class="insight-card">
      <div class="insight-title">TOP FAILING STEPS</div>
      <ul class="insight-list">${stepsHtml}</ul>
    </div>

    <div class="insight-card">
      <div class="insight-title">TRACE BUCKETS</div>
      <ul class="insight-list">${bucketsHtml}</ul>
    </div>
  `;
}

/**
 * FILTERS
 */
function applyFilters(preservePage = false) {
  const search = document.getElementById('search')?.value?.toLowerCase() || '';

  const status = document.getElementById('statusFilter')?.value || '';

  const reason = document.getElementById('reasonFilter')?.value || '';

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

  FILTERED_ROWS = rows;
  if (!preservePage) CURRENT_PAGE = 1;
  renderPage();
}

function renderPage() {
  const totalRows = FILTERED_ROWS.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  if (CURRENT_PAGE > totalPages) CURRENT_PAGE = totalPages;
  if (CURRENT_PAGE < 1) CURRENT_PAGE = 1;

  const start = (CURRENT_PAGE - 1) * PAGE_SIZE;
  const pageRows = FILTERED_ROWS.slice(start, start + PAGE_SIZE);

  renderTable(pageRows);
  renderPagination(totalRows, totalPages, start);
}

function renderPagination(totalRows, totalPages, start) {
  const container = document.getElementById('pagination');
  if (!container) return;

  if (totalRows === 0) {
    container.innerHTML = '';
    return;
  }

  const end = Math.min(start + PAGE_SIZE, totalRows);

  const pageButtons = buildPageButtons(CURRENT_PAGE, totalPages);
  const atFirst = CURRENT_PAGE === 1;
  const atLast = CURRENT_PAGE === totalPages;

  container.innerHTML = `
    <div class="pagination-info">
      Showing ${start + 1}-${end} of ${totalRows}
    </div>

    <div class="pagination-controls">
      <button onclick="gotoPage(1)" ${atFirst ? 'disabled' : ''}>«</button>
      <button onclick="gotoPage(${CURRENT_PAGE - 1})" ${atFirst ? 'disabled' : ''}>‹</button>
      ${pageButtons}
      <button onclick="gotoPage(${CURRENT_PAGE + 1})" ${atLast ? 'disabled' : ''}>›</button>
      <button onclick="gotoPage(${totalPages})" ${atLast ? 'disabled' : ''}>»</button>

      <select class="pagination-size" onchange="changePageSize(this.value)">
        ${[10, 25, 50, 100, 250]
          .map(
            (n) =>
              `<option value="${n}" ${n === PAGE_SIZE ? 'selected' : ''}>${n} / page</option>`,
          )
          .join('')}
      </select>
    </div>
  `;
}

function buildPageButtons(current, total) {
  const pages = [];
  const range = 2;

  for (let i = 1; i <= total; i++) {
    if (
      i === 1 ||
      i === total ||
      (i >= current - range && i <= current + range)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return pages
    .map((p) =>
      p === '...'
        ? `<span class="pagination-ellipsis">…</span>`
        : `<button onclick="gotoPage(${p})" class="${p === current ? 'active' : ''}">${p}</button>`,
    )
    .join('');
}

function gotoPage(page) {
  CURRENT_PAGE = page;
  renderPage();
}

function changePageSize(size) {
  PAGE_SIZE = Number(size) || 25;
  CURRENT_PAGE = 1;
  renderPage();
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
      <div><b>${escapeHtml(t.step)}</b></div>
      <div>${escapeHtml(t.status)}</div>
      <div>${escapeHtml(t.ts || '-')}</div>
      ${t.message ? `<div>${escapeHtml(JSON.stringify(t.message))}</div>` : ''}
      ${t.data ? `<pre>${escapeHtml(JSON.stringify(t.data, null, 2))}</pre>` : ''}
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

      <div class="modal-url">${escapeHtml(url)}</div>

      <div>
        <b>Status:</b> ${escapeHtml(row.status)}<br/>
        <b>Reason:</b> ${escapeHtml(row.reason)}<br/>
        <b>PDP:</b> ${escapeHtml(pdp)}<br/>
        <b>Cart:</b> ${escapeHtml(cart)}<br/>
        <b>Diff:</b> ${escapeHtml(diff)}
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
        <td>${escapeHtml(r.status)}</td>

        <td>
          <div style="display:flex; gap:8px; align-items:center;">
            <button data-action="open" data-url="${escapeHtml(url)}">OPEN</button>
            <button data-action="copy" data-url="${escapeHtml(url)}">COPY</button>
            <button data-action="trace" data-url="${escapeHtml(url)}">TRACE</button>
            ${r.screenshot ? `<a href="${escapeHtml(screenshotHref(r.screenshot))}" target="_blank">PNG</a>` : ''}
          </div>
        </td>

        <td>${escapeHtml(pdp)}</td>
        <td>${escapeHtml(cart)}</td>
        <td>${escapeHtml(diff)}</td>
        <td>${escapeHtml(formatReason(r))}</td>
      </tr>
    `;
    })
    .join('');
}

/**
 * EVENTS
 */
document.getElementById('search')?.addEventListener('input', applyFilters);

document
  .getElementById('statusFilter')
  ?.addEventListener('change', applyFilters);

document
  .getElementById('reasonFilter')
  ?.addEventListener('change', applyFilters);

document.getElementById('table')?.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action][data-url]');
  if (!button) return;

  const url = button.dataset.url || '';
  switch (button.dataset.action) {
    case 'open': {
      const safeUrl = safeExternalUrl(url);
      if (safeUrl) window.open(safeUrl, '_blank', 'noopener,noreferrer');
      break;
    }
    case 'copy':
      void navigator.clipboard.writeText(url).catch((error) => {
        console.warn('[COPY FAILED]', error);
      });
      break;
    case 'trace':
      openTraceByUrl(url);
      break;
  }
});

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function screenshotHref(absPath) {
  const normalized = String(absPath).replace(/\\/g, '/');
  const idx = normalized.indexOf('/data/');
  return idx >= 0 ? normalized.slice(idx) : '#';
}

function formatReason(r) {
  if (r.reason === 'SELECTOR_NOT_FOUND' && r.selector) {
    return `SELECTOR_NOT_FOUND (${r.selector})`;
  }
  if (r.reason === 'MISSING_PRICE' && r.detail) {
    return `MISSING_PRICE (${r.detail})`;
  }
  return r.reason || '-';
}

document.getElementById('runSelect')?.addEventListener('change', async (e) => {
  ACTIVE_RUN = e.target.value;
  await loadSnapshot();
  await loadCompareBanner();
});

document.getElementById('compareRunSelect')?.addEventListener('change', () => {
  loadCompareBanner();
});

/**
 * RUN CONTROLS
 */
let WAS_RUNNING = false;
let LIVE_POLL_TIMER = null;

async function refreshRunStatus() {
  try {
    const res = await fetch('/api/runs/active');
    const data = await res.json();
    applyRunStatus(data.active);
  } catch (err) {
    console.warn('[runs/active] failed', err);
  }
}

function applyRunStatus(active) {
  const stageBtn = document.getElementById('runStageBtn');
  const prodBtn = document.getElementById('runProdBtn');
  const status = document.getElementById('runStatus');
  const checkbox = document.getElementById('runScreenshots');

  const running = !!active;

  if (stageBtn) stageBtn.disabled = running;
  if (prodBtn) prodBtn.disabled = running;
  if (checkbox) checkbox.disabled = running;

  if (status) {
    if (running) {
      status.textContent = `Running: ${active.env} · screenshots ${active.screenshots ? 'on' : 'off'} · started ${active.startedAt}`;
      status.classList.add('active');
    } else {
      status.textContent = 'Idle';
      status.classList.remove('active');
    }
  }

  // Child-process crawls don't emit on the in-process resultBus, so the
  // SSE stream never sees their writes. Poll the snapshot endpoint while
  // a run is active so the table updates live, and do one final refresh
  // when it transitions back to idle.
  if (running && ACTIVE_RUN === 'current' && !LIVE_POLL_TIMER) {
    LIVE_POLL_TIMER = setInterval(() => {
      loadSnapshot();
    }, 3000);
  }

  if (!running && LIVE_POLL_TIMER) {
    clearInterval(LIVE_POLL_TIMER);
    LIVE_POLL_TIMER = null;
  }

  if (WAS_RUNNING && !running && ACTIVE_RUN === 'current') {
    loadSnapshot();
    loadRunsList();
  }

  WAS_RUNNING = running;
}

async function startRun(env) {
  const screenshots = !!document.getElementById('runScreenshots')?.checked;

  const confirmMsg =
    env === 'prod'
      ? `Start a PROD crawl${screenshots ? ' WITH screenshots' : ''}?`
      : `Start a STAGE crawl${screenshots ? ' WITH screenshots' : ''}?`;
  if (!window.confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/runs/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ env, screenshots }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Failed to start: ${err.error || res.status}`);
      return;
    }

    const data = await res.json();
    applyRunStatus(data.active);
    loadSnapshot();
  } catch (err) {
    alert(`Failed to start: ${err}`);
  }
}

document
  .getElementById('runStageBtn')
  ?.addEventListener('click', () => startRun('stage'));
document
  .getElementById('runProdBtn')
  ?.addEventListener('click', () => startRun('prod'));

refreshRunStatus();
setInterval(refreshRunStatus, 5000);

loadRunsList();
loadSnapshot();
if (ACTIVE_RUN === 'current') {
  initStream();
}

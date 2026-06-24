# BestPrice UA — Crawler & E2E Automation

End-to-end pipeline for [bestprice.com.ua](https://bestprice.com.ua):

- **Crawler** — concurrent product-page crawler that extracts PDP/cart prices, validates parity, and streams results to a dashboard.
- **UI tests & integration tests** — Playwright + Page Object Model for the storefront.
- **Unit tests** — Vitest for parsing, validation, retry, and extractors.

```
sitemap -> URL filter -> concurrent workers (browser pool) -> crawl + validate -> result store -> dashboard (SSE)
```

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Crawler](#running-the-crawler)
- [Dashboard](#dashboard)
- [Running Tests](#running-tests)
- [Page Object Model](#page-object-model)
- [CI/CD](#cicd)
- [Code Quality](#code-quality)
- [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Tool                        | Purpose                               |
| --------------------------- | ------------------------------------- |
| **Node.js (>=20 / lts/\*)** | Runtime                               |
| **TypeScript**              | Static typing                         |
| **Playwright**              | Browser automation (crawl + UI tests) |
| **Vitest**                  | Unit & integration tests              |
| **Express**                 | Dashboard HTTP/SSE server             |
| **Cheerio + xml2js**        | Sitemap & JSON-LD parsing             |
| **Axios**                   | HTTP fetch                            |
| **p-limit**                 | Concurrency primitives                |
| **dotenv / dotenv-cli**     | Environment management                |
| **Prettier**                | Formatting                            |
| **GitHub Actions**          | CI                                    |

---

## Project Structure

```
bestPrice/
├── config/
│   ├── appConfig.ts            # baseUrl, sitemap discovery
│   ├── executionConfig.ts      # env / mode / concurrency / screenshots
│   └── path.ts                 # DATA_DIR, RUNS_DIR, RESULTS_PATH
├── crawler/
│   ├── browser/browserPool.ts  # Reusable Playwright browser pool
│   ├── engine/
│   │   ├── concurrentEngine.ts # Worker loop + URL-level retry
│   │   ├── selectUrls.ts       # Sample / full mode URL selection
│   │   └── shutdown.ts         # SIGINT/SIGTERM cooperative shutdown
│   ├── extractors/             # PDP / JSON-LD / cart extractors
│   ├── ingestion/              # Sitemap fetcher + URL filter
│   ├── observability/          # Trace classifier (buckets)
│   ├── output/
│   │   ├── resultStore.ts      # NDJSON writer + EventEmitter (SSE)
│   │   ├── readNdjson.ts
│   │   └── runArchive.ts       # Per-run history under data/runs/
│   ├── retry/retry.ts          # Generic retry utility
│   ├── selectors/selectors.ts
│   ├── sitemap/                # Standalone sitemap price-check pipeline
│   ├── types/CrawlResult.ts    # CrawlStatus, CrawlReason, TraceEvent, TraceBucket
│   ├── utils/                  # parsePrice, screenshot, cartReady, logger
│   ├── validation/validator.ts
│   ├── workers/crawlWorker.ts
│   └── crawl.ts                # Per-URL crawl function
├── dashboard/
│   ├── server.ts               # /api/results /api/stats /api/runs /api/results-stream
│   └── loadResults.ts
├── dashboard-ui/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── scripts/
│   ├── run-crawl.ts            # Crawler entrypoint
│   ├── check-sitemap-prices.ts # Sitemap-only price audit
│   └── diagnose-product.ts     # Single-URL debug helper
├── src/
│   ├── components/Header.ts    # Header POM
│   └── fixtures/index.ts       # Playwright test fixtures
├── tests/
│   ├── business/               # Cross-cutting business rules
│   ├── e2e/                    # Playwright smoke (crawl + sitemap)
│   ├── header/                 # Playwright UI tests (desktop + mobile)
│   ├── integration/            # Playwright integration tests
│   └── unit/                   # Vitest unit tests (extractors, retry, utils, validation)
├── data/                       # Local results.ndjson + runs/<runId>/
├── playwright.config.ts
├── vitest.config.ts
└── package.json
```

---

## Prerequisites

- Node.js **>= 20** (CI uses `lts/*`)
- npm
- Disk space for `data/runs/` (each archived run is a few MB on stage, more on full prod crawls)

---

## Installation

```bash
git clone git@github.com:Qaden86/bestPrice.git
cd bestPrice
npm ci
npx playwright install --with-deps   # only needed for Playwright tests / live crawl
```

---

## Configuration

Copy `.env.example` and create `.env.stage` and/or `.env.prod`:

```bash
cp .env.example .env.stage
cp .env.example .env.prod
```

| Variable                      | Default                          | Description                                                                           |
| ----------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| `BASE_URL`                    | `https://bestprice.com.ua`       | Site origin used by the crawler & Playwright tests                                    |
| `NODE_ENV`                    | `stage`                          | `stage` or `prod` (drives default concurrency)                                        |
| `EXECUTION_MODE`              | `full`                           | `full` or `sample`                                                                    |
| `SAMPLE_SIZE`                 | `100`                            | URLs to crawl in sample mode                                                          |
| `CRAWL_CONCURRENCY`           | `3` (stage) / `5` (prod)         | Worker count                                                                          |
| `CRAWL_BROWSER_POOL_SIZE`     | worker count                     | Reused Chromium processes, capped at worker concurrency                               |
| `CRAWL_BROWSER_ROTATE_AFTER`  | `200`                            | Relaunch each pooled browser after this many completed jobs                           |
| `CRAWL_JOB_TIMEOUT_MS`        | `120000`                         | Total deadline for one crawl attempt                                                  |
| `CRAWL_LEASE_TIMEOUT_MS`      | `150000`                         | Scheduler recovery threshold; keep above the job deadline                             |
| `CRAWL_RUN_RETENTION`         | `50`                             | Number of archived runs retained locally                                              |
| `SITEMAP_REQUEST_TIMEOUT_MS`  | `15000`                          | Sitemap HTTP request timeout                                                          |
| `DASHBOARD_HOST`              | `127.0.0.1`                      | Dashboard bind address; localhost by default                                          |
| `CRAWL_SCREENSHOTS`           | `true` (sample) / `false` (full) | Failure screenshots. Set `true`/`false` to override the default for the current mode. |
| `CRAWL_SCREENSHOT_TIMEOUT_MS` | `8000`                           | Viewport-only screenshot timeout                                                      |
| `CRAWL_SMOKE_STRICT`          | `false`                          | If `true`, the E2E smoke spec asserts an OK result with matching cart price           |

Concurrency precedence: `CRAWL_CONCURRENCY` env var > environment default (`stage`/`prod`). See `config/executionConfig.ts`.

---

## Running the Crawler

| Command                      | Description              |
| ---------------------------- | ------------------------ |
| `npm run crawl:stage`        | Crawl using `.env.stage` |
| `npm run crawl:stage:sample` | Sample run on stage      |
| `npm run crawl:stage:full`   | Full sitemap on stage    |
| `npm run crawl:prod`         | Crawl using `.env.prod`  |
| `npm run crawl:prod:sample`  | Sample run on prod       |
| `npm run crawl:prod:full`    | Full prod crawl          |

Override concurrency ad hoc:

```bash
CRAWL_CONCURRENCY=8 npm run crawl:stage
CRAWL_SCREENSHOTS=false CRAWL_CONCURRENCY=10 npm run crawl:prod:full
```

Output:

- Live stream -> `data/results.ndjson`
- Previous run is archived to `data/runs/<runId>/` (with `results.ndjson` + `manifest.json`) before each new run starts.
- `Ctrl-C` triggers a cooperative shutdown — partial results stay on disk.

### URL-level retry

The engine retries each URL up to **3 attempts** when it fails with a transient reason (`NAVIGATION_FAILED`, `CART_NOT_READY`, `CRAWL_FAILED`, `INTERNAL_ERROR`). Each attempt has a total deadline and a unique scheduler lease, so an expired attempt cannot finalize a newer retry. Non-transient failures (`PRICE_MISMATCH`, `SELECTOR_NOT_FOUND`, `MISSING_PRICE`, `PRICE_IS_ZERO`, `ADD_TO_CART_FAILED`) are not retried.

### Sitemap-only price audit

```bash
npx tsx scripts/check-sitemap-prices.ts
```

Skips PDP rendering — uses sitemap + JSON-LD extraction only. Useful for fast price-presence checks.

### Single URL Diagnostics

```bash
npx tsx scripts/diagnose-product.ts <product-url>
```

---

## Dashboard

```bash
npm run dashboard
```

Then open <http://localhost:3000>.

Endpoints:

| Path                       | Purpose                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `/api/results`             | Current run rows                                                                          |
| `/api/stats`               | Totals + success/fail rate + reason counts + **bucketDistribution** + **topFailingSteps** |
| `/api/runs`                | List of archived runs                                                                     |
| `/api/runs/:runId/results` | Rows for one archived run                                                                 |
| `/api/runs/:runId/stats`   | Stats for one archived run                                                                |
| `/api/runs/compare?a=&b=`  | Diff between two runs (improved / regressed / stability delta / reason trends)            |
| `/api/results-stream`      | Server-Sent Events stream of live updates                                                 |

The UI surfaces:

- TOTAL / SUCCESS RATE / FAIL RATE / CART FAIL RATE
- **Top failing steps** (e.g. `pdp.extract`, `cart.click`)
- **Trace bucket distribution** (`INFRA_FAILURE`, `DOM_DRIFT`, `BUSINESS_LOGIC_FAIL`, ...)
- Filtering by status / reason
- Run selector & run comparison
- Per-row trace inspector modal

---

## Running Tests

| Command                    | What                                                  |
| -------------------------- | ----------------------------------------------------- |
| `npm test`                 | Vitest unit tests (`tests/unit/**`)                   |
| `npm run test:integration` | Playwright integration tests (`tests/integration/**`) |
| `npm run test:e2e`         | e2e Playwright tests                                  |
| `npm run test:header`      | Header UI tests (desktop + mobile)                    |
| `npm run test:sitemap`     | Sitemap E2E                                           |
| `npm run test:all`         | Vitest + Playwright                                   |

The Playwright crawl smoke (`tests/e2e/crawl.smoke.spec.ts`) runs in **contract mode** by default — asserts the pipeline produces a navigable result with a PDP price and cart-click attempt, without requiring an OK status. Set `CRAWL_SMOKE_STRICT=true` to assert a full OK + matching cart price (use when the target product is known good).

---

## Allure Reports

Vitest (Unit Layer)
Reporter: allure-vitest/reporter
Results directory: allure-results-vitest
Report output: allure-report-vitest

| Command                        | What                             |
| ------------------------------ | -------------------------------- |
| `npm run test:allure:unit`     | run unit tests (`tests/unit/**`) |
| `npm run allure:generate:unit` | generate report                  |
| `npm run allure:open:unit`     | open report                      |

Playwright (E2E / Integration Layer)
Reporter: allure-playwright
Results directory: allure-results
Report output: allure-report-playwright

| Command                           | What                                                 |
| --------------------------------- | ---------------------------------------------------- |
| `npm run test:allure:e2e`         | run full E2E suite (tests/e2e/\*\*)                  |
| `npm run test:allure:integration` | run integration tests (tests/integration/\*\*)       |
| `npm run test:allure:header`      | run header UI tests (tests/header/\*\*)              |
| `npm run test:allure:sitemap`     | run sitemap tests (tests/e2e/sitemap.spec.ts)        |
|                                   |                                                      |
| `npm run allure:generate:e2e`     | Generate E2E report                                  |
| `npm run allure:open:e2e`         | Open E2E report                                      |
| `npm run allure:clean`            | removes all allure results and reports (both layers) |
| `npm run test:allure`             | runs full suite + generates separate reports         |

Pipeline flow:
Clean previous results
Run Vitest unit tests -> allure-results-vitest
Run Playwright E2E tests -> allure-results
Generate unit report -> allure-report-vitest
Generate e2e report -> allure-report-playwright

## Page Object Model

UI tests use Playwright fixtures + a single Header component (`src/components/Header.ts`).

Pattern:

1. **Component** — `src/components/Header.ts` exposes locators (`searchInput`, `cartButton`, etc.) and high-level actions (`submitSearch`, `openMobileMenu`).
2. **Fixture** — `src/fixtures/index.ts` extends Playwright's `test` to inject a ready-to-use `header` instance:

   ```ts
   import { test, expect } from '../../src/fixtures';

   test('search submits to /poshuk', async ({ header, page }) => {
     await header.submitSearch('генератор');
     await expect(page).toHaveURL(/\/poshuk/);
   });
   ```

3. **Spec** — `tests/header/header.spec.ts` covers desktop and mobile (via `test.use({ viewport, isMobile, hasTouch })`).

Adding a new page object:

- Drop a new class under `src/components/` (or introduce `src/pages/` if you need full-page POMs).
- Add a fixture entry in `src/fixtures/index.ts`.
- Write specs in `tests/<feature>/<feature>.spec.ts`.

---

## CI/CD

Single GitHub Actions workflow: `.github/workflows/ci.yml`.

**Integration tests are intentionally excluded from PR gating because of flakiness on live data sources. Smoke coverage remains mandatory on every PR.**

### PR gating (every push / pull request)

| Job            | What runs                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| **unit**       | `npm run typecheck` + `npm run test:unit` (Vitest)                                                    |
| **playwright** | header UI, sitemap smoke (`SITEMAP_LIMIT=25`), crawl contract smoke (`tests/e2e/crawl.smoke.spec.ts`) |

The `integration` job is **skipped** on push/PR — this is deliberate, not a misconfiguration.

### Manual / pre-release

| Job             | How to run                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **integration** | GitHub -> _Actions_ -> _CI_ -> _Run workflow_ — full browser crawl with strict `OK` + price match (`tests/integration`) |

Use `CRAWL_SMOKE_STRICT=true` locally before promoting to verify strict success against the target product.

---

## Code Quality

- `npm run typecheck` — strict TypeScript (`tsc --noEmit`)
- `npm run format` — Prettier across the repo

There is no ESLint config checked in yet; Prettier is the source of truth for formatting.

---

## Troubleshooting

### `page.screenshot: Timeout 30000ms exceeded` during a full crawl

The crawl is still progressing (`[PROGRESS]` keeps counting) but failure handling was spending 30s per URL on full-page PNGs. Use `CRAWL_SCREENSHOTS=false` (already set on `:full` scripts) or rely on the viewport-only, non-fatal screenshot path in `crawler/utils/screenshot.ts`.

### A URL keeps failing as `NAVIGATION_FAILED`

The engine retries transient failures up to 3 times — if it still fails, the site is likely throttling. Lower `CRAWL_CONCURRENCY` and check `data/results.ndjson` for the per-attempt trace.

### Dashboard Shows No Data

- Make sure a crawl has produced `data/results.ndjson`.
- Or pick a past run from the **Run** selector — archived runs live under `data/runs/`.

### `cartFailureRate` Looks Wrong

It counts both `ADD_TO_CART_FAILED` rows and rows missing a `cartPrice`. If you want only the explicit fails, filter by reason `ADD_TO_CART_FAILED` in the table.

### Ctrl-C Left A Half-Written `results.ndjson`

That's expected — partial results are kept on disk; the run is marked interrupted and won't be archived. Re-run when you're ready.

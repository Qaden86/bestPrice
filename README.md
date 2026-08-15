# BestPrice UA — Crawler and Test Automation

TypeScript test-automation project for [bestprice.com.ua](https://bestprice.com.ua). It combines a concurrent browser crawler, price validation, live-site Playwright checks, isolated Vitest tests, and an Express dashboard for inspecting crawl results.

## Project Overview

The crawler discovers product URLs from the sitemap, visits product pages with pooled Chromium contexts, extracts PDP and cart prices, validates price parity, and writes NDJSON results. A dashboard exposes current and archived runs over HTTP and Server-Sent Events (SSE).

The automated checks cover the crawler's internal components and its live-site contracts:

- price parsing, JSON-LD extraction, configuration, validation, retry, scheduling, persistence, and browser-pool behavior;
- full PDP-to-cart price validation for one configured product;
- sitemap JSON-LD price checks;
- desktop and mobile header behavior.

## Architecture

```text
sitemap
  -> URL filtering and selection
  -> concurrent scheduler
  -> browser pool and crawl workers
  -> PDP/cart extraction
  -> validation
  -> NDJSON result store
  -> dashboard API and SSE stream
```

Key design boundaries:

- `config/` validates application, execution, and Playwright settings.
- `crawler/engine/` schedules work, limits concurrency, retries transient failures, and recovers expired leases.
- `crawler/browser/` owns reusable Chromium processes and isolated contexts.
- `crawler/extractors/` and `crawler/validation/` separate data collection from business-rule evaluation.
- `crawler/output/` serializes results and archives completed runs.
- `dashboard/` reads current and archived data and serves the dashboard UI.

## Test Strategy

The suite separates deterministic component checks from tests that depend on the live storefront.

| Test level   | Location             | Runner     | Scope                                                                                |
| ------------ | -------------------- | ---------- | ------------------------------------------------------------------------------------ |
| Unit         | `tests/unit/`        | Vitest     | Pure logic and controlled failure paths with mocked browser/file-system dependencies |
| Integration  | `tests/integration/` | Playwright | Live product page through the complete PDP, cart, and validation flow                |
| E2E          | `tests/e2e/`         | Playwright | Live crawler contract and sitemap-to-product JSON-LD price checks                    |
| UI component | `tests/header/`      | Playwright | Desktop and mobile header controls, navigation, search, cart, and responsive menu    |

### Unit tests

Vitest runs only `tests/unit/**/*.test.ts`. These tests isolate parsing, comparison, JSON-LD extraction, validation outcomes, configuration guards, retry behavior, scheduler leases, browser-pool lifecycle, result-store writes, run archiving, and worker cleanup.

### Integration tests

`tests/integration/crawl.spec.ts` calls the real crawl pipeline against `BASE_URL` and `TEST_PRODUCT_SLUG`. It requires an `OK` result, numeric PDP and cart prices, and an exact price match. Because it depends on mutable live data, CI runs it only through manual workflow dispatch.

### E2E tests

`tests/e2e/crawl.smoke.spec.ts` launches Chromium and verifies the live navigation, PDP extraction, and cart-attempt trace. `tests/e2e/sitemap.spec.ts` discovers product pages and checks for positive JSON-LD offer prices.

### Smoke tests

The default crawl smoke checks the pipeline contract without requiring the live product to complete with `OK`. Set `CRAWL_SMOKE_STRICT=true` to additionally require a cart price, successful validation, and matching PDP/cart prices. CI also limits the sitemap smoke to 25 products with `SITEMAP_LIMIT=25`.

### Regression tests

The full sitemap scenario is tagged `@regression` and skipped unless `SITEMAP_FULL=1`. It removes the sitemap limit and checks every discovered product for a positive JSON-LD offer price:

```bash
SITEMAP_FULL=1 npm run test:sitemap
```

This is a live-site regression check; its duration and result depend on the current sitemap and storefront.

## Covered Engineering Scenarios

The unit suite explicitly verifies:

- pooled browser contexts are released after navigation failure, job timeout, and late lease acquisition;
- never-settling asynchronous operations are terminated by the crawl deadline;
- timed-out browser-pool waiters do not create unhandled promise rejections;
- failed asynchronous context creation returns capacity to queued or subsequent callers;
- partial browser-pool initialization closes launched browsers and can be retried;
- browsers rotate after the configured completed-job threshold;
- stale scheduler completions cannot overwrite a newer lease;
- expired leases are recovered and become terminal failures after retry exhaustion;
- retry succeeds after transient failures and propagates the final error after exhaustion;
- queued NDJSON writes are flushed, and failed batches remain available for retry;
- duplicate, empty, malformed, and non-HTTP crawl inputs are rejected or normalized;
- configuration rejects invalid environments, URLs, slugs, worker counts, retries, and incompatible timeouts;
- validation distinguishes missing selectors, missing prices, zero prices, and price mismatches.

## Repository Structure

```text
bestPrice/
├── config/                    # Runtime and test configuration
├── crawler/
│   ├── browser/               # Chromium pool and context leases
│   ├── engine/                # Scheduler, URL selection, shutdown
│   ├── extractors/            # Product and JSON-LD price extraction
│   ├── ingestion/             # Sitemap loading and URL filtering
│   ├── observability/         # Trace classification
│   ├── output/                # NDJSON store and run archive
│   ├── retry/                 # Generic retry helper
│   ├── sitemap/               # Sitemap price-check pipeline
│   ├── validation/            # Crawl-result rules
│   └── workers/               # Deadline-bound crawl worker
├── dashboard/                 # Express API and SSE server
├── dashboard-ui/              # Static dashboard client
├── scripts/                   # Crawl and diagnostic entry points
├── src/
│   ├── components/            # Header page object
│   └── fixtures/              # Playwright fixtures
├── tests/
│   ├── unit/
│   │   ├── browser/
│   │   ├── config/
│   │   ├── engine/
│   │   ├── extractors/
│   │   ├── output/
│   │   ├── retry/
│   │   ├── utils/
│   │   ├── validation/
│   │   └── workers/
│   ├── integration/
│   ├── e2e/
│   └── header/
├── .github/workflows/ci.yml
├── playwright.config.ts
├── vitest.config.ts
└── package.json
```

## Installation

Requirements: Node.js 20.19.0 or newer within the Node 20 release line, or Node.js 22.13.0 or newer; npm; and Chromium for browser-based checks. The repository's `.nvmrc` selects the verified Node 20.19.0 baseline.

```bash
git clone https://github.com/Qaden86/bestPrice.git
cd bestPrice
npm ci
npx playwright install --with-deps chromium
```

Create local environment files from the checked-in example:

```bash
cp .env.example .env.stage
cp .env.example .env.prod
```

The main test inputs are:

| Variable                                                                 | Purpose                                            |
| ------------------------------------------------------------------------ | -------------------------------------------------- |
| `BASE_URL`                                                               | Storefront origin                                  |
| `TEST_ENV`                                                               | `stage` or `prod` Playwright profile               |
| `TEST_PRODUCT_SLUG`                                                      | Product used by crawl smoke and integration checks |
| `PW_RETRIES`, `PW_WORKERS`                                               | Validated Playwright overrides                     |
| `PW_TEST_TIMEOUT_MS`, `PW_ACTION_TIMEOUT_MS`, `PW_NAVIGATION_TIMEOUT_MS` | Validated test timeouts                            |

Crawler concurrency, browser rotation, deadlines, retention, and screenshot settings are documented in `.env.example`. CI requires `BASE_URL` and `TEST_PRODUCT_SLUG`; invalid values fail during configuration loading.

## Running Tests

These commands are defined in `package.json`:

| Command                    | Execution                                             |
| -------------------------- | ----------------------------------------------------- |
| `npm test`                 | All Vitest tests selected by `vitest.config.ts`       |
| `npm run test:unit`        | `tests/unit/` with Vitest                             |
| `npm run test:watch`       | Vitest watch mode                                     |
| `npm run test:integration` | Stage integration suite                               |
| `npm run test:e2e`         | Stage E2E suite                                       |
| `npm run test:header`      | Stage header suite                                    |
| `npm run test:sitemap`     | Stage sitemap spec                                    |
| `npm run test:all`         | Unit, integration, E2E, and header suites in sequence |
| `npm run typecheck`        | TypeScript check without emitting files               |
| `npm run lint`             | Type-aware ESLint checks                              |
| `npm run lint:fix`         | Apply ESLint's safe automatic fixes                   |
| `npm run format:check`     | Validate formatting with Prettier                     |
| `npm run format`           | Format the repository with Prettier                   |

Playwright commands also have explicit `:stage` and `:prod` variants, such as:

```bash
npm run test:e2e:stage
npm run test:e2e:prod
npm run test:integration:stage
npm run test:integration:prod
```

The unsuffixed Playwright commands resolve to their stage variants.

### Allure reports

Both runners are configured for Allure: Vitest writes `allure-results-vitest`, while Playwright writes `allure-results`. Relevant scripts include:

```bash
npm run test:allure:unit
npm run test:allure:e2e
npm run test:allure:integration
npm run test:allure:header
npm run test:allure
```

Use the `allure:generate:*` and `allure:open:*` scripts in `package.json` to generate or open the separate Vitest and Playwright reports.

## Running the Crawler

All crawler commands are defined in `package.json`:

```bash
npm run crawl:stage
npm run crawl:stage:sample
npm run crawl:stage:full
npm run crawl:prod
npm run crawl:prod:sample
npm run crawl:prod:full
```

Additional entry points:

```bash
npm run dashboard
npx tsx scripts/check-sitemap-prices.ts
npx tsx scripts/diagnose-product.ts <product-url>
```

Crawl results are appended to `data/results.ndjson`. Completed runs are archived under `data/runs/<runId>/` with their results and manifest.

## CI/CD

`.github/workflows/ci.yml` runs on pushes and pull requests targeting `main` or `master`, and supports manual dispatch.

| Job           | Trigger                    | Checks                                                                         |
| ------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `quality`     | Push, pull request, manual | Install, TypeScript check, ESLint, Prettier validation, Vitest unit suite      |
| `playwright`  | Push, pull request, manual | Chromium install, header suite, 25-product sitemap smoke, crawl contract smoke |
| `integration` | Manual only                | Strict live PDP-to-cart crawl integration                                      |

Every push and pull request is gated by TypeScript type checking, ESLint, Prettier formatting validation, unit tests, and the existing Playwright smoke checks. The workflow validates the live production URL. Integration is deliberately not a pull-request gate because its strict price assertion depends on current storefront data.

## Reliability Features

- Browser processes are pooled; each crawl uses a separate context, and pool capacity is reserved before asynchronous context creation.
- Workers apply a total per-attempt deadline and release acquired or late-arriving leases during cleanup.
- The scheduler uses lease IDs so a timed-out attempt cannot finalize a newer retry.
- A watchdog requeues expired leases with backoff and produces a terminal result after three attempts.
- Transient crawl reasons are retried; validation failures such as price mismatch or missing selectors are not.
- Browser processes rotate after a configurable number of completed jobs.
- Result writes are serialized; flush waits for active and queued writes, while failed batches remain queued for retry.
- Completed runs are archived, and cooperative `SIGINT`/`SIGTERM` shutdown preserves partial results.
- Playwright captures a trace on the first retry and a screenshot on failure.

## Future Improvements

Current, evidence-based gaps that would strengthen the project:

- add coverage reporting and enforce an agreed minimum threshold in CI;
- publish Allure reports or other test artifacts from GitHub Actions;
- add deterministic integration coverage against controlled fixtures or a test environment to reduce dependence on live data;
- add tests for dashboard API endpoints and SSE behavior;
- add automated dependency and security scanning;
- document contributor workflow and test-data maintenance in `CONTRIBUTING.md`.

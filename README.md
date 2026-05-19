# BestPrice UA

Playwright-based price crawler and UI tests for [bestprice.com.ua](https://bestprice.com.ua).

## Pipeline

```
Sitemap → URL filter → concurrent workers → crawl → result store → dashboard
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run crawl:stage` | Crawl using `.env.stage` |
| `npm run crawl:prod` | Crawl using `.env.prod` |
| `npm run crawl:stage:sample` | Sample run (see `EXECUTION_MODE`) |
| `npm run crawl:stage:full` | Full sitemap (~6.8k URLs, screenshots off) |
| `npm run crawl:prod:full` | Full prod crawl (`CRAWL_CONCURRENCY=10`, screenshots off) |
| `npm run dashboard` | Results UI at http://localhost:3000 |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright tests |

## Environment

Copy `.env.example` and create `.env.stage` / `.env.prod`:

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Site origin |
| `NODE_ENV` | `stage` or `prod` (concurrency defaults) |
| `EXECUTION_MODE` | `full` or `sample` |
| `SAMPLE_SIZE` | URLs in sample mode (default `100`) |
| `CRAWL_CONCURRENCY` | Worker count override |
| `CRAWL_SCREENSHOTS` | `false` for long full runs (default off when `EXECUTION_MODE=full`) |

### Full crawl (recommended)

```bash
# Stage — same as npm run crawl:stage:full
npm run crawl:stage:full

# Prod — explicit overrides
CRAWL_SCREENSHOTS=false CRAWL_CONCURRENCY=10 npm run crawl:prod:full
```

Results stream to `data/results.ndjson`. Use `npm run dashboard` to inspect.

## Layout

- `scripts/run-crawl.ts` — crawl entrypoint
- `crawler/` — ingestion, engine, extraction, validation
- `dashboard/` — Express API + static UI
- `tests/header/` — header UI tests (POM in `src/`)
- `tests/e2e/` — crawl smoke test

## Troubleshooting full crawls

If you see `[WORKER ERROR] ... page.screenshot: Timeout 30000ms exceeded`, the crawl is still advancing (`[PROGRESS]` keeps counting) but failure handling was spending 30s per URL on full-page PNGs. Use `CRAWL_SCREENSHOTS=false` (already set on `:full` npm scripts) or pull the latest `screenshot.ts` fix (viewport-only, non-fatal captures).

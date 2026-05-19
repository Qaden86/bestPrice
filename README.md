BestPrice UA — Hybrid Playwright Automation & Crawling System

A hybrid Playwright-based system combining:

distributed crawling engine for price extraction
reusable automation layer (E2E-ready architecture)
dashboard for execution analytics
ingestion pipeline from sitemap sources

Built with TypeScript + Playwright.

⚙️System Overview

The project operates as a pipeline-based execution system:
Sitemap → URL Ingestion → Filtering → Concurrent Execution → Extraction → Storage → Dashboard

🧩 Core Capabilities
Crawling Engine
Sitemap-based ingestion
Product page filtering
Concurrent execution with p-limit
Browser pooling (optimized Playwright lifecycle)
Retry-safe navigation layer
Screenshot capture on failure
Structured trace logging per URL

🧪 Automation Layer (E2E-ready)
Page Object Model structure
Reusable product/cart extraction logic
Selector abstraction layer (data-testid priority)
Validator-based price matching logic
Extensible for full E2E test suite

📊 Dashboard System
Local Express server (http://localhost:3000)
JSON-based results API
Aggregated metrics:
success rate
cart failure rate
match accuracy
Raw crawl trace inspection

🧱 Architecture
Execution Flow
run-crawl.ts
↓
getSitemapUrls()
↓
isProductPage filter
↓
runConcurrentEngine()
↓
BrowserPool (2–3 instances)
↓
crawlWorker()
↓
crawl() orchestrator
↓
productExtractor + validator
↓
writeResults()
↓
dashboard UI

Concurrency Model
Controlled via p-limit
Browser lifecycle managed via BrowserPool
One Chromium instance serves multiple contexts/pages
Prevents browser explosion under load

🚀 Running the System
1. Install dependencies
   npm ci
   npx playwright install --with-deps
2. Configure environment

Create .env:

BASE_URL=https://bestprice.com.ua
LIMIT=50
CONCURRENCY=3
3. Run crawler
   npm run crawl
   Stage mode
   npm run crawl:stage
4. Run dashboard
   npm run dashboard

Open:
http://localhost:3000

⚙️ Scripts
Command	Description
npm run crawl	Run crawler pipeline
npm run crawl:stage	Run crawler with stage env
npm run dashboard	Start analytics server
npm run format	Format code
npm test	Run unit tests
npm run test:e2e	Playwright E2E tests

Configuration
Environment variables
Variable	Description
BASE_URL	Target website
LIMIT	Max URLs per run
CONCURRENCY	Parallel crawl limit

📦 Key Modules
🧭 Ingestion
sitemapFetcher.ts
urlFilter.ts
🧪 Core crawler
crawl.ts (orchestrator)
crawlWorker.ts
BrowserPool
🔍 Extraction layer
productExtractor.ts
selector strategy system
🧠 Validation
validator.ts
📊 Observability
trace logger
screenshot system
trace classifier
💾 Output
file-based resultWriter.ts

🧪 Testing Strategy

The system is designed to support:

E2E UI tests (Playwright)
API tests (Vitest)
Hybrid validation flows
Regression suites for pricing accuracy

📊 Performance Notes

Recommended settings:

Environment	Concurrency	Browsers
MacBook Dev	3–5	2
Server (8–16GB RAM)	5–10	2–3
Production	10–20	3–5

⚠️ Design Principles
No browser per task (pooling required)
Deterministic retry system
Traceable execution per URL
Separation: ingestion / execution / extraction / persistence
E2E extensibility preserved

⚠️ Known Constraints
Heavy Playwright workload (CPU-bound)
Network-bound crawling at scale
Requires tuning for large batches (7000+ URLs)

🚀 Future Roadmap
Redis/BullMQ distributed queue
Persistent job recovery (resume crawling)
Adaptive concurrency tuning
Proxy rotation layer
Full E2E regression suite expansion

📌 Summary

This project is:

A hybrid Playwright automation system combining crawling, extraction, and E2E-ready architecture.
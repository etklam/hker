# Directory performance observations

This is an exploratory local measurement, not a production-capacity claim. The raw report is retained at `.impeccable/review/phase7-extended/benchmark.json` (an intentionally ignored review artifact). Reproduce it with an isolated migrated test database:

```sh
HKER_BENCHMARK_ALLOW_WRITE=1 \
DATABASE_URL=postgres://…@127.0.0.1:55439/hker_directory_test \
npm run --silent benchmark:catalog > /tmp/hker-catalog-benchmark.json
```

The script rejects non-loopback hosts, any database other than `hker_directory_test`, and runs without the explicit write flag. It gives every synthetic row a unique run namespace and removes that namespace after success or failure.

## Environment and data

Measured 2026-09-27 on Node.js 24.15.0, macOS arm64 on an Apple M4 with 10 logical CPUs and 16 GiB RAM. PostgreSQL was 16.15 in the disposable test environment with 128 MB `shared_buffers` and `max_connections=100`.

The fixture contained 3,000 Listings, 20 categories, 48 areas in eight six-level hierarchies, 12 tag groups, 240 tags and aliases, up to three tag relations per Listing, and 6,000 links. It included disabled Listings, hidden taxonomy, missing and bounded prices, and non-HKD prices.

“First call” means the first call in the benchmark process. The benchmark did not flush operating-system or PostgreSQL caches, so it is not a controlled cold-cache result. Warm results use 30 serial samples per path.

| Path | First call (ms) | Warm p50 (ms) | Warm p95 (ms) | Warm max (ms) | Queries |
| --- | ---: | ---: | ---: | ---: | ---: |
| Homepage featured | 19.34 | 2.01 | 5.88 | 8.20 | 6 |
| Empty browse | 4.16 | 2.18 | 2.54 | 2.63 | 6 |
| Chinese name search | 507.32 | 418.69 | 487.79 | 518.95 | 6 |
| Tag-alias search | 474.09 | 438.69 | 475.65 | 500.08 | 6 |
| Multi-tag AND | 9.88 | 5.67 | 8.99 | 10.42 | 7 |
| Multi-tag OR | 11.66 | 5.60 | 8.80 | 10.01 | 7 |
| Parent-area filter | 5.50 | 2.40 | 3.25 | 3.48 | 7 |
| Bounded-price filter | 5.04 | 2.24 | 3.65 | 5.15 | 6 |
| Detail | 3.31 | 1.26 | 1.50 | 1.66 | 5 |
| Admin filtered list | 56.71 | 48.59 | 52.39 | 56.90 | 6 |
| Bot result query and planning subset | 429.68 | 419.49 | 433.12 | 443.08 | 6 |

The Bot measurement covers the Bot-audience result query, hydration, and in-memory result planning. It excludes taxonomy, session, delivery-journal, and Telegram network work.

Eight concurrent clients ran 48 mixed operations in 3,693.07 ms with no errors. Per-operation latency was p50 97.67 ms and p95 1,727.84 ms, with 296 statements in total (6.17 per operation). This mixed laptop result describes this run only.

## Query plans and budgets

The recorded `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` probes show sequential scans for Chinese and tag-alias filtering. Their base ID-page probes took 86.257 ms and 95.278 ms respectively. The alias plan scanned 8,971 Listing-tag rows and used 201 tag primary-key probes. Multi-tag AND took 8.985 ms and performed an index-only Listing-tag lookup for each of 2,870 candidate Listings. Browse, parent-area, and price probes were 0.660 ms, 1.390 ms, and 2.238 ms.

These EXPLAIN probes isolate the base filter with manual ordering. They do not reproduce the service’s count query, relevance ordering, or hydration, so their timings should not be compared directly with end-to-end service latency. They identify Chinese and alias search, especially repeated relation work, as the measured bottleneck. No index or full-text extension was added from this one exploratory run.

The baseline established a five-query detail budget and a seven-query search budget. Ordinary, Admin, and Bot-result searches used six statements; public tag and area validation raised that to seven. [The query-budget regression test](../integration/query-budget.test.ts) also verifies that increasing a page from one card to twelve does not increase database round trips.

The next bounded profiling step is to run separate `EXPLAIN ANALYZE` probes for the list and count forms of Chinese-name and tag-alias search, including the actual relevance order, then isolate the name, Listing alias, tag name, and tag alias predicate arms. Compare their rows, loops, buffers, and latency at 3,000 and 10,000 synthetic Listings before changing query shape or adding an observed-purpose index.

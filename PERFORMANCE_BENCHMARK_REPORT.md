# Performance Benchmark Report

**Label: LOCAL_BENCHMARK_ONLY — not a production SLA claim**

Tool: `scripts/load-benchmark-menu.mjs` (`npm run bench:menu`)  
Target: `http://localhost:3000/menu/lilles` (Next.js `next dev`)  
Date: 2026-11-05

## Results

| Concurrency | OK | Failed | Wall clock | p50 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 25 | 25 | 0 | 13 410 ms | 13 076 ms | 13 365 ms | 13 369 ms |
| 100 | 100 | 0 | 15 997 ms | 7 183 ms | 15 883 ms | 15 905 ms |

## Interpretation

- Zero HTTP failures at 25 and 100 concurrent **menu page** fetches on local dev.
- High latency is expected under `next dev` (compilation, no CDN, shared laptop resources).
- This does **not** prove 100 concurrent **order placements**, POS checkouts, or production capacity.
- Production numbers require a staging deploy, production build (`next start`), and a proper load tool (k6) against order/payment APIs with idempotency keys.

## Next steps (not claimed done)

1. Warm production build benchmark  
2. Mixed workload: browse + cart + order submit  
3. Mongo connection pool metrics under load  
4. Duplicate-order / duplicate-payment rate under concurrent pay  

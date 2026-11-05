/**
 * LOCAL concurrent menu-read benchmark (not a production SLA claim).
 *
 * Usage: node scripts/load-benchmark-menu.mjs [concurrency] [url]
 * Example: node scripts/load-benchmark-menu.mjs 25 http://localhost:3000/menu/lilles
 */
const concurrency = Number(process.argv[2] || 25);
const url = process.argv[3] || "http://localhost:3000/menu/lilles";
const iterations = concurrency;

async function one(i) {
  const started = performance.now();
  try {
    const res = await fetch(url, { headers: { Accept: "text/html" } });
    const text = await res.text();
    return {
      i,
      ok: res.ok,
      status: res.status,
      ms: performance.now() - started,
      bytes: text.length,
    };
  } catch (error) {
    return {
      i,
      ok: false,
      status: 0,
      ms: performance.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const started = performance.now();
const results = await Promise.all(Array.from({ length: iterations }, (_, i) => one(i)));
const totalMs = performance.now() - started;
const ok = results.filter((r) => r.ok);
const latencies = ok.map((r) => r.ms).sort((a, b) => a - b);
const pct = (p) => {
  if (!latencies.length) return null;
  const idx = Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length));
  return Math.round(latencies[idx]);
};

console.log(
  JSON.stringify(
    {
      label: "LOCAL_BENCHMARK_ONLY",
      url,
      concurrency,
      ok: ok.length,
      failed: results.length - ok.length,
      wallClockMs: Math.round(totalMs),
      p50Ms: pct(50),
      p95Ms: pct(95),
      p99Ms: pct(99),
      errors: results.filter((r) => !r.ok).slice(0, 5),
    },
    null,
    2,
  ),
);

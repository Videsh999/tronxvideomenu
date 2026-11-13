/** Fail the integration run if the TAP stream skipped any test. */
export function assertNoSkippedTests(tap: string): string | null {
  const summary = tap.match(/^# skipped (\d+)/m);
  if (summary && Number(summary[1]) > 0) {
    return `Integration run skipped ${summary[1]} test(s). A skip is a failure.`;
  }
  if (/^not ok .* # SKIP/m.test(tap) || /^ok .* # SKIP/m.test(tap)) {
    return "Integration run contained a skipped test. A skip is a failure.";
  }
  return null;
}

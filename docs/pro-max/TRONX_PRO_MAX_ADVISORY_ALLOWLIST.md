# Advisory allowlist

CI fails on high or critical npm audit findings unless the GHSA id is listed here. Package names are not an allowlist entry.

## `GHSA-w5hq-g745-h8pq`

Accepted. This is the `uuid` missing buffer-bounds check in v3, v5, and v6 when the caller passes a buffer. ExcelJS 4.4.0 depends on that `uuid` release. Application code does not call `uuid`. Workbook read and write go through ExcelJS's own API, which does not use those buffered entry points. The audit's suggested fix downgrades ExcelJS to 3.4.0, which is not acceptable.

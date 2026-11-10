# Advisory allowlist

CI fails on high or critical npm audit findings unless the package is listed here with a reason.

## `exceljs`

Accepted. ExcelJS 4.4.0 depends on `uuid` below 11.1.1. That advisory applies when `uuid` v3, v5, or v6 is called with a caller-supplied buffer. This app does not call `uuid`. Workbook read and write go through ExcelJS's own API. The audit's suggested fix downgrades ExcelJS to 3.4.0, which is not acceptable.

## `uuid`

Accepted for the same reason. The vulnerable API is not called from this repository. Only ExcelJS 4.x is on the import path, and it does not use the buffered v3/v5/v6 entry points from application code.

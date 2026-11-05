# AI Financial Validation

**Measurement period:** fixture orders dated `2026-03-01` (deterministic unit suite)  
**Runner:** `aiEvaluationService.runFinancial()` / `tests/financial-reconciliation.test.ts`  
**Generated with:** Phase 5.1 evaluation snapshot (local CI)

## Metric definitions (authoritative)

| Metric | Definition | Collected money? |
|--------|------------|------------------|
| `itemsSubtotal` | Sum of `order.subtotal` on active orders | No |
| `billDiscounts` | Sum of `billDiscountAmount` on active orders | No |
| `taxAmount` | Sum of `taxAmount` on active orders | No |
| `grossOrderSales` | Sum of `order.total` on active orders (not CANCELLED/REJECTED) | No — order totals |
| `paymentsCollected` | Sum of ledger `CHARGE` by `recordedAt` in range | Yes |
| `refunds` | Sum of ledger `REFUND` by `recordedAt` in range | Contra |
| `netCollected` | `paymentsCollected − refunds` | Yes — cash reality |
| `outstandingApprox` | For active non-REFUNDED: `max(0, total − amountPaid)` | Approx AR |
| `averageOrderValue` | `grossOrderSales / activeOrderCount` | Derived |
| `activeOrderCount` | Active orders in range | Count |
| `cancelledOrRejected` | Orders with CANCELLED or REJECTED status | Count |

**Rules enforced**

- Failed / unpaid ledger entries are never counted as collected.
- Partial payments count only recorded CHARGE amounts.
- Partial refunds reduce `netCollected` via REFUND ledger lines.
- Cancelled/rejected orders are excluded from gross and outstanding.
- REFUNDED orders remain in active gross (order existed) but are skipped for outstanding.
- Gross ≠ net collected by design; mismatches are reported, never silently adjusted.

## Fixture reconciliation results

| Metric | Expected | Calculated | Δ | Result | Explanation |
|--------|----------|------------|---|--------|-------------|
| itemsSubtotal | 480 | 480 | 0 | **Passed** | Active o1+o2+o4 subtotals |
| billDiscounts | 20 | 20 | 0 | **Passed** | o1 bill discount only |
| taxAmount | 14 | 14 | 0 | **Passed** | o1 tax |
| grossOrderSales | 474 | 474 | 0 | **Passed** | 294+100+80 |
| paymentsCollected | 414 | 414 | 0 | **Passed** | 294+40+80 CHARGE |
| refunds | 80 | 80 | 0 | **Passed** | o4 full refund |
| netCollected | 334 | 334 | 0 | **Passed** | 414−80 |
| outstandingApprox | 60 | 60 | 0 | **Passed** | o2 partial remaining |
| averageOrderValue | 158 | 158 | 0 | **Passed** | 474/3 |
| activeOrderCount | 3 | 3 | 0 | **Passed** | Includes REFUNDED |
| cancelledOrRejected | 1 | 1 | 0 | **Passed** | o3 CANCELLED |

**Suite status:** Passed (11/11)  
**Production historical reconciliation:** Environment-dependent — run evaluation dashboard against live outlet exports; not claimed here.

## Classification

| Check | Status |
|-------|--------|
| Deterministic fixture reconciliation | **Passed** |
| Live multi-outlet historical audit | **Environment-dependent** |
| Tax-inclusive vs exclusive edge matrices | **Deferred** (tax stored as order `taxAmount`; fixtures tax-exclusive compute) |
| Webhook retry double-count | **Passed** (ledger ids are source; retries must not invent duplicate ledger rows — covered by payment integrity Phase 4.1) |

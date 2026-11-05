# AI Metrics Dictionary

All Phase 5 figures come from server-side analytics tools. The LLM never invents numbers.

## Sales

| Metric | Definition | Source | Notes |
|--------|------------|--------|-------|
| **Gross sales** | Sum of `order.total` for orders whose status is not `CANCELLED` or `REJECTED` | Orders | Includes tax; discounts already reflected in total |
| **Net sales** | Sum of payment ledger `CHARGE` amounts minus `REFUND` amounts in period | `order.payment.ledger` | Prefer for cash reality; may differ from gross |
| **Order count (active)** | Orders in period excluding cancelled/rejected | Orders | |
| **Order volume** | Same as active order count (forecast target) | Orders | |
| **Average ticket** | Gross sales / active order count | Derived | 0 if no active orders |
| **Paid orders** | Active orders with `payment.status === PAID` | Orders | Count only |
| **Refunded amount** | Sum of ledger `REFUND` entries in period | Ledger | |
| **Cancel rate** | Cancelled+rejected / all orders in period | Orders | |

Incomplete days (today still in progress) are **excluded** from forecast training windows.

## Inventory / food cost

| Metric | Definition | Notes |
|--------|------------|--------|
| **Estimated recipe cost / portion** | From ingredient `averageUnitCost` or `lastPurchaseUnitCost` | Marked `estimated: true` |
| **Estimated gross margin** | Sell price − estimated recipe cost | **Not** accounting/net profit |
| **Estimated food cost %** | Estimated recipe COGS / gross sales (period) when recipes exist | Incomplete coverage flagged |
| **On-hand** | `ingredient.quantityOnHand` in base unit | |
| **Pending inbound** | Sum of unreceived PO line quantities (SENT/PARTIAL) | Converted to base when possible |
| **Wastage qty** | Absolute sum of `WASTAGE` movement deltas in period | |
| **Days of cover** | onHand / predicted daily demand | Estimate |
| **Suggested reorder** | max(0, demand + safety − onHand − pendingInbound) | Never auto-placed |

## Menu intelligence

| Class | Rule (defaults) |
|-------|-----------------|
| **Star** | Popularity ≥ threshold AND estimated margin % ≥ threshold |
| **Plowhorse** | Popularity ≥ threshold AND margin % < threshold |
| **Puzzle** | Popularity < threshold AND margin % ≥ threshold |
| **Dog** | Popularity < threshold AND margin % < threshold |
| **Unclassified** | Missing recipe cost or zero sales | |

Popularity = dish qty sold / total qty sold in period. Thresholds configurable (default popularity 1/n dishes median-relative or 0.05 share; margin 30%).

## CRM

| Metric | Definition |
|--------|------------|
| **Inactive customers** | Distinct `customerId` on historical orders with no order in the last N days (default 30) |

Uses order history (authoritative) rather than possibly stale `lastOrderAt`.

## Figures source labels

Every AI response attaches one of:

- `ACTUAL` — counted from durable records  
- `ESTIMATED` — derived (recipe cost, forecast, days of cover)  
- `INSUFFICIENT_DATA` — explicitly unavailable; never fabricated  

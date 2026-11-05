# Billing Calculation Spec

**Module:** `lib/billing/calculate-bill.ts`  
**Resolver:** `lib/billing/resolve-tax-rate.ts`  
**Rounding:** `roundMoney` from `lib/order-pricing` (2 dp currency precision).

## Inputs

- Line totals (server-validated unit price × qty + add-ons − item discounts)
- Optional per-line `gstRatePercent`
- Outlet `RestaurantBillingSettings`
- Bill-level discount

## Order of operations

1. Items subtotal  
2. Subtract bill discount (must not exceed subtotal)  
3. Packaging (if enabled; method-specific; once per rule)  
4. Service charge (if enabled; on after-discount + packaging)  
5. Tax base = after-discount + packaging + service  
6. Exclusive: tax = base × rate; Inclusive: extract tax from base  
7. Split tax: INTER_STATE → IGST; else CGST+SGST  
8. Total = base (+ tax if exclusive)

## Immutability

Orders store `billSnapshot`, `cgstAmount`, `sgstAmount`, `igstAmount`, `packagingCharge`, `serviceCharge`, `taxAmount`, `total` at create/append time. Editing settings does not rewrite historical orders.

## Clients

Frontends may show estimates; **server totals are authoritative**. Client-submitted totals are ignored.

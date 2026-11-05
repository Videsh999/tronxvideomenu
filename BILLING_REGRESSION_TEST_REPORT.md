# Billing Regression Test Report

**Generated:** 2026-11-05  
**Suite:** `tests/billing-calculator.test.ts` (+ existing captain schema/assignment tests)

## Cases covered in unit suite

| Case | Status |
|------|--------|
| GST disabled | Asserted |
| GST exclusive CGST+SGST | Asserted |
| IGST inter-state | Asserted |
| Inclusive extraction | Asserted |
| Packaging per order | Asserted |
| Packaging per quantity | Asserted |
| Service charge % / fixed / disabled | Asserted |
| Discount > subtotal rejected | Asserted |
| Composite ₹1000+pack+service+5% | Asserted |
| Dish → category → outlet tax priority | Asserted |

## Channel parity

POS / Captain / QR create paths call the same `calculateRestaurantBill` and persist `billSnapshot`.

## Executed locally (2026-11-05)

```
node --import tsx --test tests/billing-calculator.test.ts
# tests 12  # pass 12  # fail 0

node --import tsx --test tests/captain-order-schema.test.ts tests/captain-assignment.test.ts
# tests 5  # pass 5  # fail 0
```

Full Atlas E2E demo restaurant run and screenshot capture depend on local env / browser.

## Unresolved limitations

- Mixed-rate proportional tax allocation is implemented; edge-case audit for refunds of mixed-rate appends should be expanded.
- Category-level tax UI editor is field-backed; primary bulk path is dish/outlet via Billing settings.

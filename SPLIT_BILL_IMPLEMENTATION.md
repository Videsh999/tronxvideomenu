# Split Bill Implementation

Supported allocation engines:

- `EQUAL`: distributes integer paise across 2–50 customers with no rounding loss.
- `CUSTOM`: requires the allocation sum to exactly equal the master bill.
- `ITEMS`: allocates quantities by stable bill-line key, rejects duplicate/over allocation and requires every billable quantity to be assigned.

Taxes, discounts and charges are shared proportionally through each allocation's share of the master total. Every allocation has an independent paid amount and status, while all ledger entries remain attached to the same master bill/session. Split configuration is locked after the first payment.

The session cannot close until the master bill outstanding amount reaches zero. Overpayment and repeated idempotency keys are rejected.

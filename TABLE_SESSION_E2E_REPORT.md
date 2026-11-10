# Table Session E2E Report

## Synthetic scenario

- One restaurant, one captain and five assigned tables.
- One active session per table.
- Three independent orders for Table 01 and Table 02.
- Independent orders for Tables 03–05.
- A sixth session with five split allocations.

## Automated coverage added

- Three orders consolidate to one ₹704 bill without duplicate lines.
- Table 01 and Table 02 totals remain isolated.
- Cancelled orders and cancelled line quantities are excluded from bill lines.
- Equal split preserves the exact paise total.
- Invalid custom totals fail.
- Duplicate item allocations fail.
- UPI intent carries exact amount, order/bill reference, payee and INR currency.

## Not physically executed

Real PSP webhook verification, physical printer/KOT output, multi-device mobile browser E2E and production Mongo transaction failover require external infrastructure not present in the local test environment. These remain release gates.

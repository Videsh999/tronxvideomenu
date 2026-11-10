# Table Session Implementation Plan

## Audit findings

- Tables already use immutable IDs and support table/room locations.
- QR orders are independent, but Captain submissions previously appended to one active order.
- Captain table workspace and table cards assumed a single active order.
- Order snapshots already preserve tax, discount, coupon, charges and payment ledgers.
- KOT and inventory are correctly order-scoped and should not be duplicated.
- No table-session or master-bill aggregate existed.
- UPI payment intents exist locally, but no PSP webhook verifier exists.

## Delivery slices

1. Add session/master-bill types, schemas, indexes and repositories.
2. Attach QR, Captain and dine-in POS orders to an atomically resolved session.
3. Stop implicit Captain order merging; keep KOT workflows order-scoped.
4. Add consolidated bill generation, fingerprinting, versioning and revision rules.
5. Add equal/custom/item split allocation and idempotent payment recording.
6. Add Captain session overview, order timeline, running balance and final bill QR.
7. Add reporting projections and historical session views.
8. Add provider webhook adapter when PSP credentials/signature rules are supplied.
9. Run Mongo concurrency, mobile E2E, lint and production build release gates.

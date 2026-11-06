# Captain POS Workflow

## Walk-in (no phone)

1. Captain signs in → **My Tables** → select table → **Take Order** / **POS**.
2. Browse / search menu → add dishes → variants & add-ons → qty / notes.
3. Optional coupon / bill discount (if permitted).
4. Review breakdown → **Place order & send to kitchen**.
5. Server: validate table assignment → `createPosOrder` or `appendItemsToOrder` → kitchen status → KOT enqueue.
6. Optional **Place order & pay** / **Record** if payment permissions allow.

## Multi-table

Cart state is keyed by table number in the POS session. Switching tables does not merge carts.

## Additional items

If the table already has an open unpaid order, new lines append; KOT is enqueued for the updated order. Existing payment history is preserved.

## QR vs Captain Direct

| Source | After submit |
|--------|----------------|
| Captain POS | Kitchen eligible immediately |
| Customer QR (policy on) | Pending Approvals → captain tick → kitchen |

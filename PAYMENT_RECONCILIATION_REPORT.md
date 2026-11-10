# Payment Reconciliation Report

## Implemented controls

- Master-bill payment reference and immutable bill version.
- Exact outstanding amount for consolidated UPI requests.
- Idempotency key stored in the master payment ledger.
- Optimistic compare-and-update against prior paid/outstanding amounts.
- Optional allocation ID for split payments.
- Overpayment and cross-allocation balance checks.
- Session closure gated on a fully paid master bill.

## Current limitation

TRONX currently records staff-verified Cash/UPI/Card payments. No bank/provider webhook credentials or signature contract exist in this repository. Therefore QR scanning never marks a bill paid automatically. Production automatic UPI reconciliation still requires a configured PSP webhook adapter, signature verification, status lookup, late-payment handling and provider event persistence.

Revenue reporting must choose either master bills or legacy per-order totals for a period, never sum both.

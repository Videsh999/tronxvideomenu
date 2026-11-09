# Consolidated Billing Guide

`Generate final bill` loads all orders by `tableSessionId`, excludes cancelled/rejected/refunded orders and creates unique line references. It aggregates persisted order financial snapshots so GST, discounts, coupons, packaging and service charges are not recalculated with newer settings.

The bill records subtotal, discounts, tax, charges, optional voluntary tip, prior verified order payments, total and outstanding balance. Repeating generation with the same fingerprint returns the same bill. Changed orders require `revise=true`; the previous version becomes `SUPERSEDED` in the same transaction.

The UPI QR uses only the master bill's outstanding amount and bill number. Scanning is not payment verification. A provider webhook/status integration must call the idempotent verified-payment path before production auto-settlement is enabled.

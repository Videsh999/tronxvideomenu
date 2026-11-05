# GST Configuration Guide

## Outlet defaults

In **Admin → Billing & tax → GST**:

- Enable/disable GST for the outlet.
- Set GST rate (%).
- Choose **Intra-state** → CGST + SGST (half each of tax amount).
- Choose **Inter-state** → IGST only.
- Choose **Exclusive** (add tax) or **Inclusive** (extract tax from prices).

Confirm classifications and rates with your tax professional before production use.

## Priority for each dish

1. Dish `taxRatePercent` override  
2. Category `taxRatePercent`  
3. Outlet GST / legacy `taxRatePercent`

Bulk apply (Billing → Bulk tax) previews affected counts and never silently overwrites overrides unless **Replace overrides** is checked and confirmed.

## What captains cannot do

Captains can view calculated bills. They cannot change restaurant tax configuration APIs.

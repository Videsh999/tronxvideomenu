# Restaurant Billing Settings — Report

**Route:** `/admin/[slug]/settings/billing`  
**Nav:** Admin → Restaurant → Billing & tax

## Sections delivered

1. General — currency, price mode (inclusive/exclusive), effective date  
2. GST — enable, rate, intra/inter supply, label (not “service tax”)  
3. Packaging — enable + method (per order / item / quantity / %)  
4. Service charge — optional fixed or %  
5. Bulk tax — preview + confirm apply to eligible dishes; preserve overrides unless confirmed replace  
6. Preview — server `/api/admin/billing/preview` using `calculateRestaurantBill`  
7. Audit — `billingAudits` collection

## APIs

- `GET/PUT /api/admin/billing` (manager only)
- `POST /api/admin/billing/preview`
- `POST /api/admin/billing/bulk-tax`

## Channel parity

POS (`createPosOrder`), Captain (same + append), QR (`createPublic`) all call `calculateRestaurantBill` and persist `billSnapshot` + CGST/SGST/IGST/packaging/service fields on the order.

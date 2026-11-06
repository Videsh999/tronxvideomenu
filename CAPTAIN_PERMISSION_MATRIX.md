# Captain Permission Matrix

Permissions live on `Captain.permissions` and are resolved with defaults in `lib/captain-permissions.ts`.

| Permission | Default | Enforced at |
|------------|---------|-------------|
| `viewBill` | true | `/captain/.../bills` |
| `requestBill` | true | Bills page access |
| `recordCashPayment` | true | `/api/orders/:id/payment` + Captain POS |
| `recordUpiPayment` | true | same |
| `recordCardPayment` | true | same |
| `applyCoupon` | true | `/api/captain/orders` + POS UI |
| `applyDiscount` | true | `/api/captain/orders` (+ max %) |
| `printReceipt` | true | Reserved for receipt flows |
| `maxDiscountPercent` | 25 | Server discount assert |
| `maxDiscountAmount` | 500 | Server discount assert |

## Never auto-granted to captains

- Payment correction / reversal
- Refunds
- Cash shift close / settlement
- Unassigned table access
- Other-outlet access

Managers configure flags under **Admin → Captains** per captain.

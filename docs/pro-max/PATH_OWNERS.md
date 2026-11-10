# Path owners for Wave 1 commits

Pushed history is not rewritten. These notes record which stream owns code that landed in a mixed commit.

## `bb8cf64` Reprice every order write

| Path | Stream | Note |
| --- | --- | --- |
| `lib/services/order.service.ts`, `lib/billing/order-bill.ts`, `lib/billing/price-line.ts`, `lib/repositories/order.repository.ts`, order routes, order tests | B Order aggregate | One bill writer. |
| `lib/db/models.ts`, `types/index.ts` | H Schema steward | Additive optional fields only. Steward accepts the snapshot and version fields. No second money schema. |
| `components/customer/CustomerMenu.tsx`, `components/customer/DishDetailModal.tsx`, `lib/meal-builder.ts` | G Customer menu | QR cannot send a variant unless the guest can choose one. G owns the screen; B owns the price. |

## `acd5adb` Staff bill preview

| Path | Stream | Note |
| --- | --- | --- |
| `lib/billing/preview-cart.ts` | B Billing | The screen helper is billing code. C may call it and may not copy the formula. |
| `components/admin/PosTerminal.tsx`, `components/captain/CaptainOrderPad.tsx`, the POS and take-order pages | C Bill UI | Display only. |

Later commits on this branch keep new billing math in `lib/billing/` and new captain screens on the captain-tables branch.

## Captain floor review

| Path | Stream | Note |
| --- | --- | --- |
| `lib/services/order.service.ts`, `lib/repositories/order.repository.ts` | B Order aggregate | Versioned writes, merged checks, and reprint events. B owns the order document. |
| `lib/billing/split-bill.ts`, `lib/billing/merge-bill.ts`, `lib/billing/payment-request-guard.ts` | B Billing | Split and merge money stays in billing. The floor service calls it. |
| `lib/db/models.ts`, `types/index.ts` | H Schema steward | Additive: `MERGED`, `captainTableScope`, floor-action index, void approvals, `previousKotNumber`. No second money schema. |

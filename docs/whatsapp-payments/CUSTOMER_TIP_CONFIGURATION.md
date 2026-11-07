# CUSTOMER_TIP_CONFIGURATION.md

**Task:** ROS-E15-T018 · **Owner:** TRONX UI UX DESIGNER · **Reviewers:** TRONX CTO + TRONX FINANCE MANAGER
**Version:** v1.0 · 2026-11-07 (IST) · **Status:** Draft for review
**Sources:** `FOUNDER_ORDER_2026-11-07.md` (Order 2, Tips), CEO defaults D1–D7 (decision log in `TIP_ACCOUNTING_AND_RECONCILIATION.md`), `UX_SPEC.md` v1.1.
**Board path note:** ROS-E15-T018's acceptance names `docs/whatsapp-payments/CUSTOMER_TIP_CONFIGURATION.md` (repo). This file is the workspace copy; it must be committed at that repo path to meet the first acceptance criterion.

> **Defaults D2, D3, D4, D5, D6 and the neutral-copy rule below are CEO product defaults — pending Founder confirmation.** Configurable per restaurant.

## 1. Master switch: `ENABLE_CUSTOMER_TIPS`
- **Default: OFF** for every org and every new outlet (ROS-E15-T032).
- Scope: per outlet, then per order type (dine-in, takeaway, delivery, reservation). Tips show only when the outlet switch is ON **and** the order type is ticked.
- **When OFF (or the order type is not ticked), these do not exist:**
  - Tip step, chips, custom field, helper text and any placeholder space on the customer payment page (component not imported; ROS-E15-T037).
  - Tip amount in any QR/payment request; the request equals the server bill payable.
  - Tip line on receipts and WhatsApp receipt messages.
  - Tip columns in staff payment panels for that order.
  - Exception: **historical** receipts/records that already contain a tip keep showing it.

## 2. Configuration (Admin › Settings › Billing & Payments › Billing Preferences — UX_SPEC §9 / ROS-E15-T043)
| Setting | Type | Default | Notes |
|---|---|---|---|
| Enable customer tips | toggle per outlet | OFF | |
| Order types | multi-select | none | |
| Suggestion mode | Percentage / Fixed | Percentage | One mode per outlet |
| Presets | up to 3 values | empty | e.g. 5/10/15 % or ₹20/₹50/₹100 |
| Allow custom tip | toggle | OFF | Shows "Custom" chip |
| Custom max | ₹ | required if custom ON | Min ₹1 |
| % base | Post-discount, pre-tax subtotal (D6) | as stated | Base configurable, Finance-owned |

Saving shows a diff dialog. Changes apply to new bills only; open bills keep their snapshot. Manager role: view the "Effective policy" preview, which has a Tips column.

## 3. Calculation and rounding (D5, D6)
- The tip is **outside `calculateRestaurantBill`**. It is added after the bill total as its own ledger component (D5).
- % tip = base × % where base = subtotal − discounts − coupon, **before tax, packaging and service charge** (D6, base configurable).
- Rounded **half-up to the whole rupee**, computed on the server, and shown before confirm.
- Worked example: subtotal ₹630 − discount ₹63 − coupon ₹50 = base ₹517. 5% = 25.85 → ₹26; 10% = 51.70 → ₹52; 15% = 77.55 → ₹78. Payable ₹564 + ₹52 = **₹616**.
- Fixed presets and custom are whole rupees.
- Partial payments (D2: OFF by default): bill components are paid first and the tip last (D4).
- Overpayment is **never** turned into a tip. It goes to MANUAL_REVIEW → refund of the excess (D3).

## 4. Customer interaction rules (UX_SPEC §5 / ROS-E15-T036, T037)
1. Options: **No tip** · presets · Custom (if allowed). **Nothing preselected**; "No tip" has equal visual weight.
2. Pay/QR stay unavailable until the customer picks one option and taps **Confirm ₹{final}**. That explicit confirmation is recorded.
3. On confirm, the server creates a new payment request for the final amount and the QR/intent regenerates (₹500 + ₹50 = ₹550). The pre-tip request is no longer payable.
4. "Change tip" cancels the current request and needs a fresh confirm.
5. Copy is neutral: "Add a tip (optional)", "No tip". No guilt or pressure copy. **Never say or imply the tip goes to a specific employee or to staff.** Final wording is Finance/Founder (ROS-E15-T008).
6. Staff can't add a tip on the customer's behalf (captain-device entry is an open question, UX_SPEC Q9).

## 5. Tip record (ROS-E15-T032)
Fields: amount, currency (INR), selection source (`none|preset_percent|preset_fixed|custom`), preset value, explicit confirmation flag + timestamp, order ID, bill ID + version, payment request ID, provider payment reference, outlet ID, org ID, created timestamp.
- Kept **separate from food revenue** in the ledger and reports.
- **No assumed tax treatment.** Finance decides with professional (CA) guidance (ROS-E15-T008, T019).
- Allocation/distribution reporting only under a legitimately configured policy. The product makes no promise of employee payout.
- A "No tip" choice is recorded as source `none`, amount 0.

## 6. Receipt rules (UX_SPEC §11)
- Tip line **only if tip > 0**, shown separately below the bill total: `Tip ₹50.00`, then `Total paid ₹550.00`.
- No tip line when tips are OFF or the tip is 0 (historical records excepted).
- Placement on the tax invoice vs a separate receipt line is pending Finance/CA (ROS-E15-T008).
- WhatsApp receipt is sent only after verified payment.

## 7. Test restaurant B (Founder order)
Pay-after-meal, tips ON (dine-in), presets **5 / 10 / 15 %**, custom allowed.
- Bill payable ₹564 (base ₹517) → chips ₹26 / ₹52 / ₹78 / Custom. Customer picks 10%, confirms → QR ₹616 → verified → receipt shows Tip ₹52, Total paid ₹616.
- Custom ₹40 → QR ₹604.
- No tip → QR ₹564, no receipt tip line.
- Restaurant A (tips off): no tip UI anywhere. Restaurant C: tips only on the order types ticked.

## 8. Acceptance criteria
- TC-1 [ROS-E15-T032, ROS-E15-T043] Given a new outlet, Then `ENABLE_CUSTOMER_TIPS` is OFF.
- TC-2 [ROS-E15-T037] Given tips OFF for the outlet/order type, Then no tip element is in the DOM and no receipt has a tip line.
- TC-3 [ROS-E15-T037, ROS-E15-T036] Given tips ON, Then no option is preselected and pay/QR are unavailable until an explicit confirm.
- TC-4 [ROS-E15-T032] Given base ₹517 and 15%, Then the tip shown is ₹78 (half-up) and is computed by the server.
- TC-5 [ROS-E15-T036, ROS-E15-T024] Given ₹500 + ₹50 confirmed, Then a ₹550 request replaces the ₹500 request, which is no longer payable.
- TC-6 [ROS-E15-T032] Given a verified tipped payment, Then a tip record with all §5 fields exists, separate from food revenue.
- TC-7 [ROS-E15-T028, ROS-E15-T027] Given an overpayment, Then it is MANUAL_REVIEW and never recorded as a tip.
- TC-8 [ROS-E15-T008] Customer copy contains no claim that a tip goes to an employee (copy review).
- TC-9 [ROS-E15-T045, ROS-E15-T046] Restaurant B scenarios in §7 pass in sandbox.
- Board criteria for ROS-E15-T018: file exists at `docs/whatsapp-payments/CUSTOMER_TIP_CONFIGURATION.md`, and it is accepted by the reviewer.

## 9. Open items
Founder confirmation of D2–D6 and the neutral-copy default · Finance/CA tax and receipt placement (ROS-E15-T008) · captain-device tip entry (UX_SPEC Q9) · whether the % base excludes packaging/service charge (assumed excluded per "pre-tax subtotal"; Finance to confirm).

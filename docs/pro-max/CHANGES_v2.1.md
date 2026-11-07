# Changes v2.1 vs v2 (2026-11-07)

Backups: `TRONX_PRO_MAX_TASK_BOARD.md.v2.bak`, `TRONX_PRO_MAX_MASTER_PLAN.md.v2.bak`, `../tasks.csv.v2.bak`. The repo was not touched.

1. **Reviewer:** ROS-E15-T001, T002, T010 and T047 now have TRONX CEO as reviewer (was "Founder (via CEO)").
2. **Founder approval (via CEO) gate** added to the acceptance criteria of:
   - ROS-E15-T001 (payment provider choice)
   - ROS-E15-T047 (first real-money test, going live, any merge or deploy to `main`)

   The plan has a new section "4a. Founder gates".
3. **`pro-max/release`** exists (created from `main` at `fcc8958`). The open question is removed and the plan is updated.
4. **Founder brief Part H / §11 / §9** are now in the brief, so that open question is removed. The QA task acceptance criteria now cite the exact appendix sections:
   - ROS-E15-T009: plan covers Part H, the §11 demo tests and the §9 failure list
   - ROS-E15-T015: report covers §11 and §9
   - ROS-E15-T021: report covers Part H tests 1–20 and the regression run
   - ROS-E15-T045: restaurants A/B/C per Part H, plus the §11 sandbox amounts
   - ROS-E15-T046: evidence for Part H, §11 and §9
5. **In Review:**
   - ROS-E15-T003 (UX spec v1.1)
   - ROS-E15-T018 (CUSTOMER_TIP_CONFIGURATION.md). It also needs committing to `docs/whatsapp-payments/` via the CEO's commit path.
6. **In Progress (Finance):** ROS-E15-T007, T008, T016, T017 and T019. T014 stays Blocked (merchant sandbox keys).
7. **Open questions added:**
   - The unnumbered CEO defaults (Manual review roles, the WhatsApp summary template, the neutral tip copy) need the Founder's confirmation.
   - No task covers a merge to `main` or the first real-money test, so the gate sits on T047.
8. **Tip base, recorded as an answer, not a question:** Finance D9 sets the tip base to the item subtotal after discount and before tax, excluding packaging and service charge. This matches CEO default D6. It is a Finance proposal pending the Founder's confirmation and is noted on ROS-E15-T008.
9. **Provider open question:** research recommends Razorpay as primary and Cashfree as fallback, both conditional. This is a recommendation only; CTO review (T001) and the Founder's decision are pending.
10. **Removed open question:** "Reviewer for CTO-owned E15 tasks", now resolved by item 1.

Status counts: In Progress 39, Backlog 61, Ready 14, In Review 2, Blocked 8 (124 total; was IP 35, BL 61, Ready 20, Blocked 8). `tasks.csv` was regenerated with 124 rows.

# Changes v2.2 vs v2.1 (2026-11-07)

Backups: `TRONX_PRO_MAX_TASK_BOARD.md.v2.1.bak`, `TRONX_PRO_MAX_MASTER_PLAN.md.v2.1.bak`, `../tasks.csv.v2.1.bak`. The repo was not touched.

1. **Coverage gaps closed.** New acceptance criteria, each citing its test or failure ID:
   - ROS-E15-T037 (tips UI): Part H #7, #8, #9 and #10 as separate checks.
   - ROS-E15-T036 (customer payment page; it renders receipts): receipt content, Part H #17 / §11 receipt generation.
   - ROS-E15-T032 (tip records): tip reporting, Part H #19. No new task, because the report change is a queued patch to the I5 reports paths.
   - ROS-E15-T034 (payment security): server-side role enforcement on every payment action, Part H #20.
   - ROS-E15-T024 (payment request model): server-side expiry, §9 payment expires / §11 expired QR.
   - ROS-E15-T026 (webhook): late webhook on an expired request goes to MANUAL_REVIEW (§9 payment expires); verified failure sets FAILED (§11 payment failure).
   - ROS-E15-T033 (WhatsApp): §9 invalid customer number and §9 template rejected.
   - ROS-E15-T027 (ledger): §9 customer pays twice (ledger idempotency, Manual review flag) and §9 webhook duplicated.
   - ROS-E15-T028 (partial payments): §9 customer pays twice / overpayment, with the excess flagged for refund.
2. **New gate tasks** (Backlog, reviewer TRONX CEO, extra gate "Founder approval (via CEO)"):
   - ROS-E15-T048 First real-money test. Owner TRONX QA ENGINEER. Depends on T001, T045 and T046.
   - ROS-E12-T014 Release merge/deploy of `pro-max/release` to `main`. Owner TRONX DEVOPS ENGINEER. Depends on ROS-E00-T001, E01-T003, E02-T009 and E12-T003.
3. **ROS-E15-T047** keeps only the go-live gate. The first real-money and `main` merge gates moved to T048 and E12-T014. The plan's "Founder gates" section is updated.
4. **Open question removed:** "No task covers a merge or deploy to `main`, or the first real-money test."

Status counts: In Progress 39, Backlog 63, Ready 14, In Review 2, Blocked 8 (126 total; was 124). `tasks.csv` has 126 rows.

## v2.2 addendum (same version)

5. **In Review:** ROS-E15-T007 (PAYMENT_WORKFLOWS.md §5), T016 (RESTAURANT_BILLING_POLICIES.md), T017 (BILL_GENERATION_WORKFLOW.md) and T019 (TIP_ACCOUNTING_AND_RECONCILIATION.md). All four are drafts in `whatsapp-payments/` with 42 validation cases covering D8 and D9. Each still needs committing to `docs/whatsapp-payments/` via the CEO's commit path.
6. **T008 stays In Progress.** Two open questions added:
   - written CA guidance (Finance)
   - receipt tip label, 'Tip (voluntary)' (Finance) vs 'Tip' (UX_SPEC), for the Founder to approve
7. **New "PD decisions" section:**
   - PD-1: a bill can't be closed while a payment is in Manual review. PD proposal; the CTO confirms under T030/T027.
   - PD-2: when the tip base is ₹0 the tip prompt is hidden (V36). The Founder may override.

   Both are noted on the related tasks (T027, T030, T037).
8. **UX Q6 "Superseded":** stays open, assigned to the CTO. Interim position: a flag on the old request, not a ledger status.

Final v2.2 status counts: In Progress 35, Backlog 63, Ready 14, In Review 6, Blocked 8 (126 total).

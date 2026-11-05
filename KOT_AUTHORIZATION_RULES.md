# KOT Authorization Rules

1. QR submit → **no KOT**.
2. Captain APPROVE → KOT via existing `enqueueKotPrintSafe` after kitchen transition.
3. Captain direct confirm → KOT after PREPARING handoff.
4. Append items on authorized order → new lines `QUEUED`; kitchen path / reopen as today.
5. REJECT / CORRECTION → **no KOT**.
6. Duplicate APPROVE → **no second KOT** (409 before kitchen).
7. Printer down → order + KDS state preserved; print warning only.
8. KDS list excludes pending/rejected/correction authorization states.

# ADR plan

Status of every file in this directory is **Proposed**. Proposed author for 0001–0005: TRONX BACKEND ENGINEER. That author line is **pending CTO confirmation**. ADR 0005 covers KOT failure alerts and retries. No KOT ADR was numbered 0006, so none was renumbered to 0012. ADRs 0006–0011 are the CTO payment and WhatsApp records, also Proposed. The CTO accepts an ADR by changing its status in a later review. These documents record the decision the Pro Max wave is aiming at. They do not change application code.

| ADR | Title |
| --- | --- |
| [0001](0001-tenancy.md) | Tenancy: organization and outlet |
| [0002](0002-identity.md) | Identity and per-handler auth contracts |
| [0003](0003-billing-snapshots.md) | Billing snapshots |
| [0004](0004-transaction-requirements.md) | Transactions, versions, and crash retry |
| [0005](0005-polling.md) | Polling, KOT alerts, and correlation |
| [0006](0006-payment-provider-abstraction.md) | Payment provider abstraction and direct settlement |
| [0007](0007-payment-request-lifecycle.md) | Versioned payment requests |
| [0008](0008-payment-verification-ledger.md) | Verified events, idempotency, and the single ledger |
| [0009](0009-billing-and-kitchen-policies.md) | Billing policy resolution and independent kitchen release |
| [0010](0010-optional-tip-ledger.md) | Optional tips as a separate ledger component |
| [0011](0011-whatsapp-tenant-messaging.md) | Tenant-isolated WhatsApp billing messages |

Related audit docs: `docs/pro-max/TRONX_PRO_MAX_ARCHITECTURE.md`, `docs/pro-max/PATH_OWNERS.md`, `docs/pro-max/TRONX_PRO_MAX_FINDINGS.md`.

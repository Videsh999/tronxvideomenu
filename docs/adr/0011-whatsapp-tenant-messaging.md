# ADR 0011 — Tenant-isolated WhatsApp billing messages

- Status: Proposed
- Date: 2026-11-07

## Context

WhatsApp transports a versioned bill or verified receipt; delivery/read does not prove payment. Restaurants must retain their own WABA/number and consent records. A shared TRONX public sender mixes tenant identity and credentials. Existing billing/writer and polling architecture stays intact (ADRs 0003–0005).

## Decision

- Server-only `lib/messaging/whatsapp/**`; each restaurant organisation authorizes its own WABA and number, not a shared TRONX WABA. CEO default, configurable and pending Founder confirmation: one WABA per organisation. Phone numbers on that WABA may be scoped to an outlet. A multi-brand organisation may set a per-brand or per-outlet WABA override. A connection binds organizationId, restaurantId, provider/environment, WABA/account id, phone-number id, credential/key-version reference, permission/approval status and billing responsibility. Every send, consent record, and webhook is keyed by organisation and outlet. No cross-tenant sharing. Retain current provider asset and messaging-account distinctions at the adapter instead of hardcoding one account and one phone.
- CEO default, pending verification of template limits: the bill template is a summary plus a secure itemized bill link. Do not promise a full itemized body inside the template until those limits are verified.
- Encrypt per-tenant credentials with authenticated tenant/connection context, rotate and honor revocation. Only trusted server mappings select sender. Protect phones at rest and use keyed normalized-number hashes for scoped lookup/dedupe. No global recipient lookup, plaintext phone/tokenized bill URL in logs, browser credential or shared cache identity.
- Consent records: org/outlet, protected recipient ref, normalized phone hash, purpose (billing/receipt distinct from marketing), opt-in source/evidence, timestamp, notice/policy version, actor, revocation time/source. Knowing a number or past purchase is not blanket consent. Proposed product rule is explicit restaurant-specific WhatsApp billing/receipt opt-in; review current official policy/legal basis before production. Recheck at dispatch: revocation suppresses queued and future sends for that purpose immediately. Retention/deletion is separately approved; lawful historical audit is not silently erased.
- Templates are versioned per tenant/WABA: provider id/name/language/category, local content version/hash, variable schema, approval/status. Only approved active account/environment templates send; validate/escape substitutions. Verify official service-window/template/category/media rules and current INR rate card before go-live/cost promises; research is not proof of account entitlement. Native payment modes/EPL are separate gated capabilities, not assumed equivalent to a plain approved bill template/link (ADR 0006).
- Durable intents: final itemized bill, remaining-balance update, verified partial acknowledgement, paid receipt or verified refund receipt. Final bill includes restaurant/outlet, order/table, localized date/time (IST for India outlet unless approved outlet timezone differs), items/quantity/line totals, discounts/coupon, packaging, service charge, tax breakdown, optional confirmed tip, payable, bill/version, current request/provider link, and supported QR. Running snapshots are not final bills. Unverified/pending payment never generates a paid confirmation/receipt.
- Outbox stores tenant, bill/version, event type, request id, collection/delivery revision where relevant, recipient ref/hash, template version/content hash, stable idempotency key, state, attempts, provider message id and correlation id. Unique business identity `(organizationId, restaurantId, billId, billVersion, eventType, recipientHash, eventRevision)`; initial-bill revision is fixed. A template update/retry does NOT create another initial bill send. A committed partial instalment has its distinct ledger revision and may trigger a clearly labelled balance update. Expired QR regeneration uses a distinct authorized request-refresh event/revision, not a replay of the stale initial bill. Changed payload with the same key conflicts. Provider message refs are unique in sender/environment namespace.
- Before send recheck current final billVersion, active request, consent, template approval, connection and resolved policy. Cancel stale queued bills; no dead QR send. Explicit correction/resend requires authorized reason/audit and limits; it is not an automatic-dedupe bypass. Once an old version was already delivered, it cannot be recalled reliably: expiry/ledger verification remains essential.
- Worker uses leases, bounded jittered backoff, retry-after, account/outlet/recipient rate limits, tenant-fair quotas and dead-letter review. Pass stable provider send key where supported. Without provider idempotency, timeout-after-send becomes UNKNOWN and requires status reconciliation/authorized review before resend. No false exactly-once external-delivery promise.
- Verify delivery webhooks over raw body with the exact product's documented signature/key, body limits, replay handling and event dedupe; match provider message id to tenant/sender. Track sent/delivered/read/failed plus occurrence time without out-of-order regression. If signed freshness is absent, dedupe and treat delivery status as informational, not financial authorization. Challenge handshake is a narrow documented handler. Incoming claimed WABA/phone id is untrusted routing context until verified. Delivery events never mutate money/order state.

## Consequences

Invalid number, template rejection, throttling, revocation and outages do not lose the POS bill or mark it paid. Show safe failure and authorized alternatives, not automatic unconsented channel substitution. Backend owns messaging infrastructure; Frontend owns dedicated UI, with C/G/E queued patches for existing screens. Demo uses synthetic/provider developer-test recipients only, no real customers. Current Meta permissions/asset ownership/template/payment-mode approval and production pricing require verification; no real send is authorized here.

## Alternatives

Global WABA, browser-direct sends, unapproved free-form templates, refreshing a page to send and conflating delivery with payment are rejected.

## Security

Least-privilege tokens/sender configuration, CSRF/origin and role checks, encrypted phones/consent evidence, narrow opaque expiring/revocable bill-link tokens, rotation, rate/body limits and redacted correlation logs. Audit consent/account/manual-send changes. Marketing requires separate consent; keep PII retention bounded. Cross-outlet sender or recipient selection fails closed.

## Test/acceptance criteria

- Two restaurants/WABAs cannot share recipients, credentials, templates, consent, cache/dedupe/message ids or delivery records; isolate per-outlet queues/quotas even on explicitly shared org assets.
- Missing/revoked consent, rejected template, bad variables, invalid number, disconnect and stale bill/request suppress send; revocation between queue and dispatch wins.
- Duplicate jobs, crash/retry, timeout-after-send, partial balance updates, bill supersession, QR refresh and out-of-order callbacks preserve dedupe and truthful payment status.
- Signature failure/replay/rotation/body limits/provider outage/noisy tenant are safe; payment receipt intent originates once from the committed ledger, remains visible in POS if WhatsApp fails.
- Produce WHATSAPP_TEMPLATE_GUIDE.md and WHATSAPP_PAYMENT_E2E_REPORT.md with actual sandbox evidence, permissions/official-policy review and honest native-payment test limitations before completion.

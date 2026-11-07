# ADR 0005 — Polling, KOT alerts, and correlation

- Status: Proposed
- Date: 2026-11-07

## Context

Kitchen, captain, orders, tables, and guest status use HTTP polling. There is no WebSocket or SSE server. The device connector polls `GET /api/connector/jobs`. KOT enqueue failures are caught and returned as a warning (`lib/services/order.service.ts:1312-1325`). A warning on an API response is easy to miss on a busy floor.

## Decision

Keep polling for this wave. Do not add a second order state machine in the browser. An SSE channel can replace a poll later without changing the order document.

A failed or unprinted KOT after accept or append creates an outlet-visible alert and uses the print job's existing attempt counter and dedupe key for retries. The order write still commits. The alert is the signal that the ticket did not print.

Every order event, payment ledger entry, and print job stores the request correlation id. `correlationId` in `lib/db/mongo-tx.ts` is the helper. Logs that carry it are structured JSON and redact phone, email, passwords, cookies, pairing codes, connector secrets, and payment account fields.

## Consequences

Stream B writes the id on the order. Stream K writes it on the print job and raises the alert when delivery fails. Stream L puts the id on the request log line. Marketing copy that says the kitchen updates instantly is G's to correct while polling remains the mechanism.

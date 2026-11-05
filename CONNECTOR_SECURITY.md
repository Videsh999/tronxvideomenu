# Connector Security

## Pairing

- Admin-only (`OUTLET_DEVICES_MANAGE` + `HARDWARE_LOCAL_CONNECTOR`).
- Short-lived code (10 minutes), hashed at rest, single-use atomic claim.
- Rate-limited pairing creation.
- Restaurant/outlet/org bound from pairing record — connector cannot choose tenancy.

## Credentials

- Connector secret shown once; cloud stores SHA-256 hash only.
- Auth via `x-connector-id` + `x-connector-secret` (TLS required in production).
- Rotate invalidates previous secret; revoke destroys access.
- Local storage: restricted file under ProgramData (harden with Windows ACLs; prefer Credential Manager in production packaging).

## Runtime

- No public unauthenticated local control port.
- Cloud payloads cannot execute shell or arbitrary filesystem commands.
- Allowlisted operations only (print / drawer kick / heartbeat / ack).
- Logs redact secrets and pairing codes.
- Job acks are outlet-scoped; cross-outlet jobs rejected.

## Print safety

- Duplicate cloud jobs suppressed by `dedupeKey`.
- Uncertain outcomes → `UNKNOWN` / `MANUAL_REVIEW` — no silent auto-reprint of financial receipts.
- Simulator devices remain labelled `SIMULATED` and never appear as physical connectors.

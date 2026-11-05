# Local Connector Architecture

## Role

The **TRONX Device Connector** is a Windows-local Node service that:

1. Pairs securely with TRONX Cloud (short-lived single-use code).
2. Polls authenticated job APIs over TLS.
3. Executes predefined ESC/POS / drawer operations on LAN printers.
4. Acknowledges jobs with `COMPLETED`, `FAILED`, `UNKNOWN`, or `MANUAL_REVIEW`.

Cloud POS/KDS continue to call `deviceService` only. Simulator adapters remain registered.

## Components

| Location | Responsibility |
|----------|----------------|
| `lib/services/connector.service.ts` | Pairing, credentials, heartbeat, poll, ack, revoke/rotate |
| `app/api/connector/*` | Connector-facing APIs (credential auth) |
| `app/api/devices/connectors/*` | Admin pairing / list / revoke / rotate |
| `lib/devices/adapters/connector/` | Cloud CONNECTOR adapter (defers PRINT) |
| `device-connector/` | Local Windows app |

## Job flow

1. POS payment / KDS accept → `enqueuePrintJob` for CONNECTOR device → status `QUEUED`.
2. Connector `GET /api/connector/jobs` claims jobs → `PROCESSING`.
3. Local ESC/POS TCP send.
4. Connector `POST .../ack` with terminal status.
5. Uncertain write/timeout after send → `UNKNOWN` / `MANUAL_REVIEW` — **no automatic financial reprint**.

## Security invariants

- Outlet/org IDs come from pairing record / connector credential binding — never from connector body.
- Secrets stored hashed in cloud; plaintext shown once.
- No unauthenticated local control port.
- No shell execution from cloud payloads.
- Only allowlisted device operations.

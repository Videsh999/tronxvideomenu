# Connector Operations Guide (Phase 6.3)

## Pairing

1. Admin: Devices → **Add Local Connector**.
2. Enter the single-use code on the Windows host (`device-connector` → `npm run pair`).
3. Store `connectorSecret` in the OS credential store (shown once).
4. Configure printer host/IP in the Devices dashboard.

Pairing is rate-limited (10/min/restaurant).

## Heartbeat & health

- Connector posts heartbeat with optional per-device health.
- Cloud marks connectors offline when heartbeat exceeds `CONNECTOR_OFFLINE_AFTER_MS`.
- Fleet inventory may show `DEGRADED` when online but devices report errors.

## Credential rotation

Devices → connector → **Rotate credentials**. Previous secret is invalidated immediately. Redeploy secret on the Windows host before polling resumes.

## Revocation

**Revoke** sets status `REVOKED`, rotates hash, and blocks authenticate/poll/heartbeat. Reassign printers to another live connector before or after revoke.

## Multi-connector per outlet

Supported. Assign printers so each physical printer belongs to **one** connector. Overlapping assignment is an admin misconfiguration; atomic claims still prevent duplicate processing.

## Diagnostics

**Export diagnostics** redacts secrets. Include in pilot evidence packs with OS/connector versions.

## Do not

- Expose connector secrets in browser storage or logs.
- Open unauthenticated local control ports.
- Shell-out from the connector for arbitrary commands.
- Mark hardware PHYSICALLY_VERIFIED without paper confirmation.

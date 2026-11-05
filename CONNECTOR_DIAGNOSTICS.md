# Connector Diagnostics

## Dashboard

`/admin/[slug]/devices` shows:

- Connector online/offline (heartbeat stale > 90s → OFFLINE)
- Job counts (pending / failed / unknown)
- Device health and last seen
- Export diagnostics button

## Export bundle

`GET /api/devices/diagnostics` (RBAC: devices manage)

Includes redacted:

- Connector summaries (no secrets)
- Device config (host/port/width only)
- Recent job metadata + correlation IDs
- Compatibility registry
- Explicit `physicalVerification: NONE`

Never includes:

- Connector secrets / credential hashes  
- Pairing codes  
- Raw payment methods / customer phones  

## Local connector

- `%ProgramData%\TRONX\DeviceConnector\local-jobs.json`  
- Console logs (secrets redacted)  
- Disk-full persistence raises a clear error and does not silently drop jobs  

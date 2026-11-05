# Windows Connector Installation

## Requirements

- Windows 10/11 POS PC on the same LAN as network printers
- Node.js 20+ (or packaged executable — see Packaging)
- Outbound HTTPS to your TRONX Cloud URL
- ENTERPRISE feature `HARDWARE_LOCAL_CONNECTOR` enabled

## Install (development / MSI precursor)

1. Copy the `device-connector/` folder to the POS PC (or clone the repo).
2. `cd device-connector && npm install && npm run build`
3. Set cloud URL:
   - PowerShell: `$env:TRONX_CLOUD_BASE_URL="https://your-tronx-host"`
   - Or edit `%ProgramData%\TRONX\DeviceConnector\config.json` after first run
4. Pair:
   - In admin: **Devices → Add Local Connector** → copy pairing code
   - On POS: `npm run pair` → enter code
5. In Devices dashboard, edit the physical printer device configuration: set `host` (printer IP) and `port` (usually `9100`).
6. Start: `npm start` (or `node dist/main.js`)
7. Optional: Task Scheduler / NSSM to run at logon as a background service.

## Upgrade

1. Stop the connector process.
2. Replace `device-connector` files / rebuild.
3. Restart. Credentials persist under the data directory unless rotated/revoked.

## Uninstall

1. Stop/disable the scheduled task or service.
2. Revoke the connector in the Devices dashboard.
3. Delete `%ProgramData%\TRONX\DeviceConnector` (contains credentials — destroy securely).

## Diagnostics

- Console logs redact secrets.
- Local uncertain jobs: `%ProgramData%\TRONX\DeviceConnector\local-jobs.json`
- Cloud: Devices → print job history (`UNKNOWN` / `MANUAL_REVIEW`)

## Packaging note

A full `.msi`/`.exe` with Windows Service registration is the production target. This release ships the Node TypeScript service and installer documentation; packaging scripts live under `device-connector/src/installer/`.

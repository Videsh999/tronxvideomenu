# Installer notes

Target packaging for restaurants:

1. Bundle Node runtime + `dist/` with `pkg`, `nexe`, or an electron-free MSI (WiX).
2. Install to `C:\Program Files\TRONX\DeviceConnector`.
3. Data/credentials under `%ProgramData%\TRONX\DeviceConnector` with ACL limited to SYSTEM + Administrators + the service account.
4. Register an NSSM or Windows Service: `tronx-device-connector.exe` with `TRONX_CLOUD_BASE_URL`.
5. First-run wizard launches `pair` UI/CLI.

This directory documents the packaging strategy; the Phase 6.1 deliverable is the runnable Node service plus guides.

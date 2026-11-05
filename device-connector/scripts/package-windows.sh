#!/usr/bin/env bash
# Reproducible Windows packaging precursor (run on Windows CI or with wine/pkg).
# Does NOT claim a verified MSI/service install — produces a zip of the Node service.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run build
STAGE="${ROOT}/dist-windows-package"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -R dist package.json "$STAGE/"
cp -R src/installer "$STAGE/installer" 2>/dev/null || true
cat > "$STAGE/README-RUN.txt" <<'EOF'
TRONX Device Connector — Windows package
1. Install Node.js 20+ LTS (or use a bundled runtime in a future MSI).
2. Set TRONX_CLOUD_BASE_URL to your cloud HTTPS URL.
3. npm install --omit=dev
4. node dist/main.js pair
5. Configure printer host/port in cloud Devices UI.
6. node dist/main.js
7. Use Task Scheduler / NSSM for auto-start (see WINDOWS_CONNECTOR_INSTALLATION.md).

Physical printer verification is separate — see HARDWARE_PILOT_CHECKLIST.md.
EOF
(cd "$STAGE" && zip -qr ../tronx-device-connector-windows.zip .)
echo "Wrote tronx-device-connector-windows.zip"

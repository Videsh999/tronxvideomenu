# Device Adapter Guide

## Contract

Implement `DeviceAdapter` from `lib/devices/device.types.ts`:

```ts
interface DeviceAdapter {
  readonly adapterType: DeviceAdapterType;
  connect(device: DeviceRecord): Promise<DeviceCommandResult>;
  disconnect(device: DeviceRecord): Promise<DeviceCommandResult>;
  healthCheck(device: DeviceRecord): Promise<DeviceCommandResult>;
  sendCommand(device: DeviceRecord, command: DeviceCommand): Promise<DeviceCommandResult>;
}
```

Register with:

```ts
registerDeviceAdapter("ESC_POS", "RECEIPT_PRINTER", new EscPosReceiptAdapter());
```

## Replacing the simulator

1. Keep `device.service` and APIs unchanged.
2. Implement a physical/connector adapter under `lib/devices/adapters/printer/` (or cash-drawer, etc.).
3. Register it for the matching `adapterType` + `deviceType`.
4. When creating a device record, set `adapterType` / `connectionType` accordingly and `simulated: false`.
5. Do **not** change POS/KDS call sites — they already call `deviceService`.

## Simulator reference

`lib/devices/adapters/simulator/*` shows expected command names and result shapes:

| Device | Commands |
|--------|----------|
| Receipt / kitchen printer | `PRINT`, `SIMULATE_PAPER_OUT`, `SIMULATE_OFFLINE`, `SIMULATE_RECOVER`, `SIMULATE_PRINT_FAIL` |
| Cash drawer | `OPEN_DRAWER` (requires `authorized: true`), `CLOSE_DRAWER` |
| Barcode | `SCAN` |
| Payment terminal | `PAYMENT_REQUEST`, `PAYMENT_CANCEL` — `contaminatesLedger: false` |
| Customer display | `DISPLAY_UPDATE` |

## Payment terminal rule

Physical adapters may eventually talk to a PSP SDK. Until settlement is confirmed by the PSP and mapped through a dedicated payment integration, **do not** write CHARGE ledger entries from device callbacks alone. Simulator results set `settlement: "NONE"`.

## Local connector sketch

1. Connector enrolls with restaurant/outlet + device ids.
2. Cloud issues short-lived tokens (rotate; never embed provider secrets in the browser).
3. Cloud `device-manager` selects `CONNECTOR` adapter which forwards authenticated commands to the connector.
4. Connector executes ESC/POS / drawer kick / scanner HID locally and reports events.

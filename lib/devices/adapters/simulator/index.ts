import { registerDeviceAdapter } from "@/lib/devices/device-registry";
import { SimulatorBarcodeScannerAdapter } from "@/lib/devices/adapters/simulator/barcode-scanner";
import { SimulatorCashDrawerAdapter } from "@/lib/devices/adapters/simulator/cash-drawer";
import { SimulatorCustomerDisplayAdapter } from "@/lib/devices/adapters/simulator/customer-display";
import { SimulatorKitchenPrinterAdapter } from "@/lib/devices/adapters/simulator/kitchen-printer";
import { SimulatorPaymentTerminalAdapter } from "@/lib/devices/adapters/simulator/payment-terminal";
import { SimulatorReceiptPrinterAdapter } from "@/lib/devices/adapters/simulator/receipt-printer";

let registered = false;

/** Idempotent registration of all Phase 6 simulator adapters. */
export function ensureSimulatorAdaptersRegistered(): void {
  if (registered) return;
  registerDeviceAdapter("SIMULATOR", "RECEIPT_PRINTER", new SimulatorReceiptPrinterAdapter());
  registerDeviceAdapter("SIMULATOR", "KITCHEN_PRINTER", new SimulatorKitchenPrinterAdapter());
  registerDeviceAdapter("SIMULATOR", "CASH_DRAWER", new SimulatorCashDrawerAdapter());
  registerDeviceAdapter("SIMULATOR", "BARCODE_SCANNER", new SimulatorBarcodeScannerAdapter());
  registerDeviceAdapter("SIMULATOR", "PAYMENT_TERMINAL", new SimulatorPaymentTerminalAdapter());
  registerDeviceAdapter("SIMULATOR", "CUSTOMER_DISPLAY", new SimulatorCustomerDisplayAdapter());
  registered = true;
}

/** Shared device integration contracts — Phase 6.0 */

export type DeviceType =
  | "RECEIPT_PRINTER"
  | "KITCHEN_PRINTER"
  | "CASH_DRAWER"
  | "BARCODE_SCANNER"
  | "CUSTOMER_DISPLAY"
  | "PAYMENT_TERMINAL";

/** Logical printer role within an outlet (Phase 6.3 fleet). */
export type PrinterRole =
  | "RECEIPT"
  | "KITCHEN"
  | "BAR"
  | "SECONDARY_RECEIPT"
  | "OTHER";

export type ConnectorHealthDisplay = "ONLINE" | "OFFLINE" | "DEGRADED" | "REVOKED";

/** Job claim lease — prevents two connectors claiming the same job. */
export const PRINT_JOB_LEASE_MS = 60_000;

export type DeviceConnectionType =
  | "SIMULATOR"
  | "NETWORK"
  | "USB"
  | "BLUETOOTH"
  | "KEYBOARD_WEDGE"
  | "LOCAL_CONNECTOR";

export type DeviceAdapterType = "SIMULATOR" | "ESC_POS" | "CONNECTOR" | "SDK";

export type DeviceConnectionStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "CONNECTING"
  | "ERROR"
  | "DISABLED";

export type DeviceHealthStatus = "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";

export type PrintJobType =
  | "RECEIPT"
  | "BILL"
  | "KOT"
  | "KOT_CANCEL"
  | "KOT_MODIFY"
  | "REPRINT_RECEIPT"
  | "REPRINT_KOT"
  | "TEST_PAGE";

export type PrintJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  /** Sent to printer but confirmation lost — do not auto-retry financial receipts. */
  | "UNKNOWN"
  /** Requires human review before reprint. */
  | "MANUAL_REVIEW";

export type ConnectorStatus = "ONLINE" | "OFFLINE" | "REVOKED" | "PAIRING";

export type DeviceConnectorRecord = {
  id: string;
  restaurantId: string;
  outletId: string;
  organizationId?: string;
  name: string;
  /** Never store plaintext secret — only hash. */
  credentialHash: string;
  credentialVersion: number;
  status: ConnectorStatus;
  version?: string;
  hostname?: string;
  lastHeartbeatAt?: string;
  lastSeenAt?: string;
  pairedAt: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ConnectorPairingCodeRecord = {
  id: string;
  restaurantId: string;
  outletId: string;
  organizationId?: string;
  /** Hashed pairing code. */
  codeHash: string;
  expiresAt: string;
  usedAt?: string;
  createdBy: string;
  createdAt: string;
};

export type DeviceCommandName =
  | "PRINT"
  | "OPEN_DRAWER"
  | "CLOSE_DRAWER"
  | "SCAN"
  | "DISPLAY_UPDATE"
  | "PAYMENT_REQUEST"
  | "PAYMENT_CANCEL"
  | "HEALTH_CHECK"
  | "SIMULATE_PAPER_OUT"
  | "SIMULATE_OFFLINE"
  | "SIMULATE_RECOVER"
  | "SIMULATE_PRINT_FAIL";

export type DeviceRecord = {
  id: string;
  organizationId?: string;
  restaurantId: string;
  outletId: string;
  name: string;
  deviceType: DeviceType;
  manufacturer: string;
  model: string;
  connectionType: DeviceConnectionType;
  adapterType: DeviceAdapterType;
  connectionStatus: DeviceConnectionStatus;
  healthStatus: DeviceHealthStatus;
  lastSeenAt?: string;
  capabilities: string[];
  configuration: Record<string, unknown>;
  /** Always true for Phase 6.0 sample/simulator devices. */
  simulated: boolean;
  enabled: boolean;
  /** Kitchen station binding for KITCHEN_PRINTER */
  kitchenStation?: string;
  /** Fleet printer role — must be compatible with deviceType. */
  printerRole?: PrinterRole;
  /** Last successful print job completion time (observability). */
  lastSuccessfulJobAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type DeviceCommand = {
  name: DeviceCommandName;
  payload?: Record<string, unknown>;
  timeoutMs?: number;
  idempotencyKey?: string;
};

export type DeviceCommandResult = {
  ok: boolean;
  simulated: boolean;
  status: "SUCCESS" | "FAILED" | "TIMEOUT" | "REJECTED" | "PENDING";
  message: string;
  data?: Record<string, unknown>;
  errorCode?: string;
};

export type DeviceEventRecord = {
  id: string;
  restaurantId: string;
  outletId: string;
  deviceId: string;
  type: string;
  simulated: boolean;
  payload: Record<string, unknown>;
  createdAt: string;
  actorId?: string;
};

export type PrintJobRecord = {
  id: string;
  restaurantId: string;
  outletId: string;
  deviceId: string;
  orderId?: string;
  jobType: PrintJobType;
  /** Deduplication key — same key will not enqueue twice while active/completed. */
  dedupeKey: string;
  payloadSnapshot: Record<string, unknown>;
  status: PrintJobStatus;
  attemptCount: number;
  maxAttempts: number;
  isReprint: boolean;
  simulated: boolean;
  errorMessage?: string;
  connectorId?: string;
  payloadHash?: string;
  /** Links related queue/ack/events for diagnostics. */
  correlationId?: string;
  /** Lease holder while PROCESSING — expired leases may be reclaimed. */
  leaseConnectorId?: string;
  leaseExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

/** Adapter contract — simulator and future physical adapters share this. */
export interface DeviceAdapter {
  readonly adapterType: DeviceAdapterType;
  connect(device: DeviceRecord): Promise<DeviceCommandResult>;
  disconnect(device: DeviceRecord): Promise<DeviceCommandResult>;
  healthCheck(device: DeviceRecord): Promise<DeviceCommandResult>;
  sendCommand(device: DeviceRecord, command: DeviceCommand): Promise<DeviceCommandResult>;
}

export type ReceiptPreview = {
  title: string;
  lines: string[];
  simulatedBanner: string;
  totals: { subtotal: number; discount: number; tax: number; total: number };
};

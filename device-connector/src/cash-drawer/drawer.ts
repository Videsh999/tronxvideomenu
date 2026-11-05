import { buildDrawerKickBytes, sendEscPos, type EscPosPrinterConfig } from "../printers/escpos.js";

export type DrawerOpenRequest = {
  authorized: boolean;
  reason?: string;
  userId?: string;
  shiftId?: string;
  outletId?: string;
};

/**
 * Opens cash drawer via printer kick. Does not claim physical open verification
 * unless hardware feedback exists (rare).
 */
export async function openCashDrawer(
  printer: EscPosPrinterConfig,
  request: DrawerOpenRequest,
): Promise<{
  ok: boolean;
  commandAccepted: boolean;
  physicallyVerified: false;
  status: "COMPLETED" | "FAILED" | "UNKNOWN";
  message: string;
}> {
  if (!request.authorized) {
    return {
      ok: false,
      commandAccepted: false,
      physicallyVerified: false,
      status: "FAILED",
      message: "Unauthorized drawer open rejected",
    };
  }
  const kick = buildDrawerKickBytes(printer);
  if (!kick) {
    return {
      ok: false,
      commandAccepted: false,
      physicallyVerified: false,
      status: "FAILED",
      message: "Drawer kick unsupported by printer capabilities",
    };
  }
  const outcome = await sendEscPos(printer, kick, {
    kind: "DRAWER_OPEN",
    reason: request.reason,
    userId: request.userId,
    shiftId: request.shiftId,
    outletId: request.outletId,
  });
  return {
    ok: outcome.status === "COMPLETED",
    commandAccepted: outcome.status === "COMPLETED" || outcome.status === "UNKNOWN",
    physicallyVerified: false,
    status: outcome.status === "COMPLETED" ? "COMPLETED" : outcome.status === "UNKNOWN" ? "UNKNOWN" : "FAILED",
    message:
      outcome.status === "COMPLETED"
        ? "Drawer kick sent (physical open not verified)"
        : outcome.status === "UNKNOWN"
          ? "Drawer kick uncertain — manual check required"
          : `Drawer kick failed: ${"errorMessage" in outcome ? outcome.errorMessage : "error"}`,
  };
}

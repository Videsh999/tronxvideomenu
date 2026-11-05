import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { DEVICES_MANAGE_PERMISSION } from "@/lib/devices/device-permissions";
import { hardwarePilotService } from "@/lib/services/hardware-pilot.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const startSchema = z
  .object({
    outletId: z.string().min(1).optional(),
    connectorId: z.string().optional(),
    deviceId: z.string().optional(),
    deviceModel: z.string().max(120).optional(),
    osVersion: z.string().max(120).optional(),
    connectorVersion: z.string().max(40).optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireOutletPermission({
    feature: "HARDWARE_LOCAL_CONNECTOR",
    permission: DEVICES_MANAGE_PERMISSION,
  });
  if (!auth.ok) return auth.response;
  const [runs, steps] = await Promise.all([
    hardwarePilotService.listRuns(auth.restaurantId),
    Promise.resolve(hardwarePilotService.listGuidedSteps()),
  ]);
  return NextResponse.json({ success: true, data: { runs, steps } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const auth = await requireOutletPermission({
    feature: "HARDWARE_LOCAL_CONNECTOR",
    permission: DEVICES_MANAGE_PERMISSION,
    requestedOutletId: parsed.data.outletId,
  });
  if (!auth.ok) return auth.response;

  const run = await hardwarePilotService.startRun({
    restaurantId: auth.restaurantId,
    outletId: parsed.data.outletId ?? auth.restaurantId,
    performedBy: auth.accountId,
    connectorId: parsed.data.connectorId,
    deviceId: parsed.data.deviceId,
    deviceModel: parsed.data.deviceModel,
    osVersion: parsed.data.osVersion,
    connectorVersion: parsed.data.connectorVersion,
  });
  const executed = await hardwarePilotService.runAutomatedChecks({
    restaurantId: auth.restaurantId,
    runId: run.id,
    deviceId: parsed.data.deviceId,
  });
  return NextResponse.json({ success: true, data: executed ?? run });
}

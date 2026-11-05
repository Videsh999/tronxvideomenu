import { NextResponse } from "next/server";
import { requireConnectorAuth } from "@/lib/connector-auth";
import { connectorService, ConnectorServiceError } from "@/lib/services/connector.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    version: z.string().max(40).optional(),
    hostname: z.string().max(120).optional(),
    devices: z
      .array(
        z.object({
          deviceId: z.string().min(1),
          health: z.enum(["HEALTHY", "DEGRADED", "UNHEALTHY", "UNKNOWN"]),
          connectionStatus: z.enum(["CONNECTED", "DISCONNECTED", "CONNECTING", "ERROR", "DISABLED"]),
        }),
      )
      .max(50)
      .optional(),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireConnectorAuth(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const data = await connectorService.heartbeat(auth.connector, parsed.data);
    return NextResponse.json({ success: true, data: { status: data?.status, lastHeartbeatAt: data?.lastHeartbeatAt } });
  } catch (cause) {
    if (cause instanceof ConnectorServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Heartbeat failed." }, { status: 500 });
  }
}

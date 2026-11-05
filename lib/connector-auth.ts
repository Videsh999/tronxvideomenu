import { NextResponse } from "next/server";
import { connectorService, ConnectorServiceError } from "@/lib/services/connector.service";
import type { DeviceConnectorRecord } from "@/lib/devices/device.types";

export async function requireConnectorAuth(
  request: Request,
): Promise<
  { ok: true; connector: DeviceConnectorRecord } | { ok: false; response: NextResponse }
> {
  const connectorId =
    request.headers.get("x-connector-id")?.trim() ||
    new URL(request.url).searchParams.get("connectorId")?.trim() ||
    "";
  const secret =
    request.headers.get("x-connector-secret")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";

  if (!connectorId || !secret) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Missing connector credentials." }, { status: 401 }),
    };
  }

  try {
    const connector = await connectorService.authenticateConnector(connectorId, secret);
    return { ok: true, connector };
  } catch (cause) {
    if (cause instanceof ConnectorServiceError) {
      return {
        ok: false,
        response: NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode }),
      };
    }
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 }),
    };
  }
}

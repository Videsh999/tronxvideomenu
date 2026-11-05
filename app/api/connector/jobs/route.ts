import { NextResponse } from "next/server";
import { requireConnectorAuth } from "@/lib/connector-auth";
import { connectorService } from "@/lib/services/connector.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireConnectorAuth(request);
  if (!auth.ok) return auth.response;
  const jobs = await connectorService.pollJobs(auth.connector);
  const devices = await connectorService.listDevicesForConnector(auth.connector.id);
  return NextResponse.json({
    success: true,
    data: {
      jobs,
      devices,
      restaurantId: auth.connector.restaurantId,
      outletId: auth.connector.outletId,
    },
  });
}

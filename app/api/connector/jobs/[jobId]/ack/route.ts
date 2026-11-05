import { NextResponse } from "next/server";
import { requireConnectorAuth } from "@/lib/connector-auth";
import { connectorService, ConnectorServiceError } from "@/lib/services/connector.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ jobId: string }> };

const ackSchema = z
  .object({
    status: z.enum(["COMPLETED", "FAILED", "UNKNOWN", "MANUAL_REVIEW", "CANCELLED"]),
    errorMessage: z.string().max(500).optional(),
    payloadHash: z.string().max(128).optional(),
  })
  .strict();

export async function POST(request: Request, { params }: Ctx) {
  const { jobId } = await params;
  const auth = await requireConnectorAuth(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const parsed = ackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const data = await connectorService.ackJob(auth.connector, jobId, parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (cause) {
    if (cause instanceof ConnectorServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Ack failed." }, { status: 500 });
  }
}

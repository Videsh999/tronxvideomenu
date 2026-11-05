import { NextResponse } from "next/server";
import { connectorService, ConnectorServiceError } from "@/lib/services/connector.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const claimSchema = z
  .object({
    code: z.string().trim().min(6).max(16),
    hostname: z.string().trim().max(120).optional(),
    connectorName: z.string().trim().max(120).optional(),
    version: z.string().trim().max(40).optional(),
  })
  .strict();

/**
 * Public to the local connector process (not browser admin session).
 * Tenancy is bound by the pairing code record created by an authorized admin.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = claimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const data = await connectorService.claimPairing(parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (cause) {
    if (cause instanceof ConnectorServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Pairing failed." }, { status: 500 });
  }
}

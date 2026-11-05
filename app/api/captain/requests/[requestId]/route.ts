import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaptain } from "@/lib/auth-server";
import { serviceRequestService } from "@/lib/services/service-request.service";

const patchSchema = z
  .object({
    status: z.enum(["ACKNOWLEDGED", "IN_PROGRESS", "DONE", "CANCELLED"]),
  })
  .strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { captain, error } = await requireCaptain();
  if (error) return error;
  const { requestId } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
  }

  const updated = await serviceRequestService.updateStatus(
    captain.restaurantId,
    requestId,
    parsed.data.status,
  );
  if (!updated) {
    return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: updated });
}

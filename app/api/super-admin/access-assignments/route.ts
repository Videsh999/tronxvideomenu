import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-server";
import {
  accessAssignmentService,
  AccessAssignmentServiceError,
} from "@/lib/services/access-assignment.service";
import { z } from "zod";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

const assignSchema = z
  .object({
    restaurantId: z.string().min(1),
    restaurantAdminAccountId: z.string().min(1).optional(),
    organizationId: z.string().min(1).nullable().optional(),
    orgRole: z
      .enum(["ORG_OWNER", "ORG_ADMIN", "OUTLET_MANAGER", "OUTLET_STAFF"])
      .nullable()
      .optional(),
    outletIds: z.array(z.string().min(1)).optional(),
    isActive: z.boolean().optional(),
    reason: z.string().max(500).optional(),
    confirm: z.literal(true),
  })
  .strict();

export async function GET(request: Request) {
  const { admin, error } = await requireSuperAdmin();
  if (error || !admin) return error ?? NextResponse.json({ success: false }, { status: 401 });

  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const organizationId = url.searchParams.get("organizationId");

  if (organizationId) {
    const data = await accessAssignmentService.listOrganizationAssignments(organizationId);
    return NextResponse.json({ success: true, data }, { headers: noStore });
  }
  if (!restaurantId) {
    return NextResponse.json(
      { success: false, error: "restaurantId or organizationId is required." },
      { status: 400, headers: noStore },
    );
  }
  const data = await accessAssignmentService.getAssignment(restaurantId);
  if (!data) {
    return NextResponse.json(
      { success: false, error: "Administrator account not found." },
      { status: 404, headers: noStore },
    );
  }
  return NextResponse.json({ success: true, data }, { headers: noStore });
}

export async function PUT(request: Request) {
  const { admin, error } = await requireSuperAdmin();
  if (error || !admin) return error ?? NextResponse.json({ success: false }, { status: 401 });

  const parsed = assignSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid assignment payload. confirm:true is required.",
        details: parsed.error.flatten(),
      },
      { status: 400, headers: noStore },
    );
  }

  try {
    const data = await accessAssignmentService.assignAccess({
      ...parsed.data,
      actorEmail: admin.email,
    });
    return NextResponse.json({ success: true, data }, { headers: noStore });
  } catch (cause) {
    if (cause instanceof AccessAssignmentServiceError) {
      return NextResponse.json(
        { success: false, error: cause.message },
        { status: cause.statusCode, headers: noStore },
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to update access assignment." },
      { status: 500, headers: noStore },
    );
  }
}

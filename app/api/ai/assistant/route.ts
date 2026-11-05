import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import {
  aiAssistantService,
  AiAssistantServiceError,
} from "@/lib/services/ai-assistant.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().min(2).max(2000),
  threadId: z.string().optional(),
  outletId: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid assistant request." }, { status: 400 });
  }

  const auth = await requireOutletPermission({
    feature: "AI_BUSINESS_ASSISTANT",
    permission: "OUTLET_REPORTS_READ",
    requestedOutletId: parsed.data.outletId,
  });
  if (!auth.ok) return auth.response;

  try {
    const data = await aiAssistantService.ask({
      restaurant: auth.restaurant,
      principal: auth.principal,
      accountId: auth.accountId,
      email: auth.email,
      message: parsed.data.message,
      threadId: parsed.data.threadId,
    });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof AiAssistantServiceError) {
      return NextResponse.json(
        { success: false, error: cause.message },
        { status: cause.statusCode },
      );
    }
    return NextResponse.json({ success: false, error: "Assistant unavailable." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin, unauthorizedResponse } from "@/lib/auth-server";
import {
  restaurantEnrichmentService,
  RestaurantEnrichmentError,
} from "@/lib/services/restaurant-enrichment.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    location: z.string().trim().max(200).optional(),
  })
  .strict();

/** Propose public profile fields from OSM + Wikipedia. Does not write. */
export async function POST(request: Request) {
  const { error } = await requireSuperAdmin();
  if (error) return unauthorizedResponse();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Provide a restaurant name (and optional location)." },
      { status: 400 },
    );
  }

  try {
    const data = await restaurantEnrichmentService.enrich(parsed.data);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof RestaurantEnrichmentError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.status });
    }
    return NextResponse.json(
      { success: false, error: "Enrichment unavailable. Try again or fill fields manually." },
      { status: 502 },
    );
  }
}

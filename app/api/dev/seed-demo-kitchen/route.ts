import { NextResponse } from "next/server";
import { seedTronxDemoKitchen } from "@/lib/demo/seed-demo-kitchen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Local/staging helper — seeds TRONX Demo Kitchen via the Next.js Mongo connection.
 * Blocked in production unless ALLOW_PRODUCTION_SEED=true.
 * If DEMO_SEED_TOKEN is set, require header: x-tronx-demo-seed: <token>
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    return NextResponse.json({ success: false, error: "Forbidden in production." }, { status: 403 });
  }

  const expected = process.env.DEMO_SEED_TOKEN?.trim();
  if (expected) {
    const provided = request.headers.get("x-tronx-demo-seed");
    if (provided !== expected) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }
  }

  try {
    const data = await seedTronxDemoKitchen();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 },
    );
  }
}

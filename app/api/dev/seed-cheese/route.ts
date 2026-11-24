import { NextResponse } from "next/server";
import { seedCheeseRestaurant } from "@/lib/demo/seed-cheese";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Local/staging helper — seeds enterprise demo restaurant "Cheese". */
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
    const data = await seedCheeseRestaurant();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 },
    );
  }
}

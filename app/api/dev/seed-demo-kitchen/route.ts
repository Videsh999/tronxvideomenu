import { NextResponse } from "next/server";
import { seedTronxDemoKitchen } from "@/lib/demo/seed-demo-kitchen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * Local helper only. Production and any non-loopback host are refused here,
 * and seedTronxDemoKitchen refuses again unless the safe-config env is set.
 * The response never includes a password.
 */
export async function POST(request: Request) {
  const host = new URL(request.url).hostname;
  if (process.env.NODE_ENV === "production" || !isLoopbackHost(host)) {
    return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
  }

  try {
    const data = await seedTronxDemoKitchen();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seed failed";
    const refused = message.startsWith("Refusing to seed");
    return NextResponse.json(
      { success: false, error: refused ? message : "Seed failed" },
      { status: refused ? 403 : 500 },
    );
  }
}

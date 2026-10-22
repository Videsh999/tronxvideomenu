import { NextResponse } from "next/server";
import { isSecureRequest, sessionCookieForRole } from "@/lib/auth-core";

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true, data: { message: "Logged out successfully" } });
  response.cookies.set({ name: sessionCookieForRole("CAPTAIN"), value: "", httpOnly: true, secure: isSecureRequest(request), sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

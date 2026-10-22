import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CAPTAIN_SESSION_COOKIE, RESTAURANT_ADMIN_SESSION_COOKIE, SUPER_ADMIN_SESSION_COOKIE, isSecureRequest, readAdminSession, sessionCookieForRole } from "@/lib/auth-core";

export const runtime = "nodejs";

function clearSession(request: Request, response: NextResponse, role: "SUPER_ADMIN" | "RESTAURANT_ADMIN" | "CAPTAIN") {
  response.cookies.set({ name: sessionCookieForRole(role), value: "", httpOnly: true, secure: isSecureRequest(request), sameSite: "lax", path: "/", maxAge: 0 });
}

export async function POST(request: Request) {
  let role: "SUPER_ADMIN" | "RESTAURANT_ADMIN" | "CAPTAIN";
  try {
    const body = await request.json() as { role?: unknown };
    if (body.role !== "SUPER_ADMIN" && body.role !== "RESTAURANT_ADMIN" && body.role !== "CAPTAIN") return NextResponse.json({ success: false, error: "Invalid logout role" }, { status: 400 });
    role = body.role;
  } catch { return NextResponse.json({ success: false, error: "Invalid logout request" }, { status: 400 }); }
  const response = NextResponse.json({ success: true, data: { message: "Logged out successfully" } });
  clearSession(request, response, role);
  return response;
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const searchParams = new URL(request.url).searchParams;
  const requestedRole = searchParams.get("role");
  const role = requestedRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : requestedRole === "CAPTAIN" ? "CAPTAIN" : "RESTAURANT_ADMIN";
  const cookieName = role === "SUPER_ADMIN" ? SUPER_ADMIN_SESSION_COOKIE : role === "CAPTAIN" ? CAPTAIN_SESSION_COOKIE : RESTAURANT_ADMIN_SESSION_COOKIE;
  const session = await readAdminSession(cookieStore.get(cookieName)?.value, process.env.AUTH_SECRET);
  const loginPath = role === "SUPER_ADMIN" ? "/super-admin/login" : role === "CAPTAIN" ? "/captain/login" : "/admin/login";
  const sectionPrefix = loginPath.replace(/\/login$/, "/");
  const next = searchParams.get("next");
  const loginUrl = new URL(loginPath, request.url);
  if (next && next.startsWith(sectionPrefix) && !next.startsWith("//")) loginUrl.searchParams.set("next", next);
  const response = NextResponse.redirect(loginUrl);
  if (session) clearSession(request, response, role);
  return response;
}

import { NextResponse, type NextRequest } from "next/server";
// Edge-safe subset of the admin auth surface — session.ts uses Web Crypto and
// must not import node:crypto, or this middleware bundle breaks. checkPasscode
// (node:crypto) lives in lib/admin/auth.ts and is only used by route handlers.
import { SESSION_COOKIE, verifySession } from "@/lib/admin/session";

const LOGIN_PAGE = "/admin/login";
const LOGIN_API = "/api/admin/login";

export default async function middleware(
  request: NextRequest,
): Promise<NextResponse | Response> {
  const { pathname } = request.nextUrl;

  // The login page itself and POST /api/admin/login stay public.
  if (pathname === LOGIN_PAGE) return NextResponse.next();
  if (pathname === LOGIN_API && request.method === "POST") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(token)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL(LOGIN_PAGE, request.url), 302);
}

export const config = {
  // Only the admin surfaces; public pages and /api/asset never match.
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

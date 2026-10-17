import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_S,
  checkPasscode,
  deriveSessionSecret,
  signSession,
} from "@/lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// (No `bodySizeLimit` segment config here — Next 16 does not support it and
// ignores it silently.) The login payload is one small JSON body; the only
// transport cap in play is next.config.ts experimental.proxyClientMaxBodySize.

export async function POST(request: Request): Promise<NextResponse> {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return NextResponse.json({ error: "ADMIN_KEY not configured" }, { status: 500 });
  }

  let passcode: unknown;
  try {
    const body: unknown = await request.json();
    passcode = (body as Record<string, unknown> | null)?.passcode;
  } catch {
    return NextResponse.json({ error: "expected JSON body {passcode}" }, { status: 400 });
  }

  if (typeof passcode !== "string" || !checkPasscode(passcode)) {
    // One generic message for wrong-passcode and wrong-shape — no oracle.
    return NextResponse.json({ error: "invalid passcode" }, { status: 401 });
  }

  const token = await signSession(await deriveSessionSecret(adminKey));
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_S,
  });
  return response;
}

/**
 * Admin auth surface for the Node runtime (API route handlers).
 *
 * The session primitives live in `@/lib/admin/session` because middleware runs
 * on the Edge runtime and must not pull `node:crypto` into its bundle — it
 * imports session.ts directly. This module adds `checkPasscode`, which is only
 * ever called from Node route handlers, and re-exports the session contract so
 * callers can import everything admin-auth from one place.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export {
  SESSION_COOKIE,
  SESSION_TTL_S,
  deriveSessionSecret,
  sha256Hex,
  signSession,
  verifySession,
} from "@/lib/admin/session";

/**
 * Compares the input against process.env.ADMIN_KEY in constant time.
 * Both sides are hashed with sha256 first so inputs of different lengths
 * still go through timingSafeEqual (which requires equal-length buffers).
 * Returns false — never throws — on empty input or when ADMIN_KEY is unset;
 * unset-key handling (HTTP 500) belongs to the route layer.
 */
export function checkPasscode(input: string): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return false;
  if (typeof input !== "string" || input.length === 0) return false;
  const expected = createHash("sha256").update(adminKey).digest();
  const provided = createHash("sha256").update(input).digest();
  return timingSafeEqual(expected, provided);
}

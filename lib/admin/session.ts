/**
 * Session signing/verification built on Web Crypto (crypto.subtle), available
 * in Node >= 20 and the Edge middleware runtime. ONE implementation therefore
 * serves both `middleware.ts` (Edge) and the admin API routes (Node) — this
 * module must never import Node built-ins, or the middleware bundle breaks.
 *
 * Token format: `${exp}.${hmacSha256(secret, exp)}` (hex), with
 * `secret = sha256(ADMIN_KEY)` (hex), `exp` = unix seconds.
 */

export const SESSION_COOKIE = "loo_admin";
export const SESSION_TTL_S = 12 * 3600;

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  let hex = "";
  for (const byte of new Uint8Array(buffer)) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

/** sha256 hex digest via Web Crypto (works on Edge and Node >= 20). */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return toHex(digest);
}

/** The session secret derived from the admin passcode: sha256(ADMIN_KEY). */
export function deriveSessionSecret(adminKey: string): Promise<string> {
  return sha256Hex(adminKey);
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(signature);
}

/** Signs a session token valid for SESSION_TTL_S seconds. */
export async function signSession(secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  const signature = await hmacSha256Hex(secret, String(exp));
  return `${exp}.${signature}`;
}

/**
 * Verifies signature, then expiry. Never throws and never returns true for
 * malformed input (missing parts, non-integer/negative/fractional exp).
 * Returns false when ADMIN_KEY is unset, so middleware denies by default.
 */
export async function verifySession(token?: string): Promise<boolean> {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || !token) return false;

  const dot = token.indexOf(".");
  // exp must be the first (dot-free) part and the signature must be non-empty;
  // extra dots land inside the signature and simply fail the comparison below.
  if (dot <= 0 || dot === token.length - 1) return false;
  const expPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);

  const exp = Number(expPart);
  // Rejects NaN, Infinity, fractions, negatives and zero. `Number` also
  // accepts forms like "0x10" or " 12 " — harmless, because the recomputed
  // HMAC covers the raw expPart string, not its numeric value.
  if (!Number.isInteger(exp) || exp <= 0) return false;
  if (exp <= Math.floor(Date.now() / 1000)) return false;

  const secret = await sha256Hex(adminKey);
  const expected = await hmacSha256Hex(secret, expPart);
  return constantTimeEqual(expected, sigPart);
}

/**
 * Constant-time comparison (XOR-accumulate over char codes) for equal-length
 * hex strings — crypto.subtle has no timingSafeEqual and node:crypto is not
 * available in the Edge middleware runtime. A length mismatch only leaks the
 * public signature length (fixed at 64 hex chars for a valid token), so the
 * early return carries no secret.
 */
function constantTimeEqual(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return diff === 0;
}

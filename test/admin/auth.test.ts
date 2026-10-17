// @vitest-environment node
// Session crypto uses Web Crypto (crypto.subtle) so ONE implementation serves
// both Edge middleware and Node route handlers; the node environment provides
// it natively (jsdom's window.crypto has no SubtleCrypto).
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_COOKIE,
  SESSION_TTL_S,
  checkPasscode,
  deriveSessionSecret,
  signSession,
  verifySession,
} from "@/lib/admin/auth";

const KEY = "correct horse battery staple";

let hadKey = false;
let originalKey: string | undefined;

function withAdminKey(value: string | undefined): void {
  originalKey = process.env.ADMIN_KEY;
  hadKey = "ADMIN_KEY" in process.env;
  if (value === undefined) delete process.env.ADMIN_KEY;
  else process.env.ADMIN_KEY = value;
}

afterEach(() => {
  process.env.ADMIN_KEY = originalKey as string;
  if (!hadKey) delete process.env.ADMIN_KEY;
  vi.useRealTimers();
});

describe("constants", () => {
  it("uses the contract cookie name and 12h TTL", () => {
    expect(SESSION_COOKIE).toBe("loo_admin");
    expect(SESSION_TTL_S).toBe(12 * 3600);
  });
});

describe("checkPasscode", () => {
  it("accepts the exact ADMIN_KEY and rejects anything else", () => {
    withAdminKey(KEY);
    expect(checkPasscode(KEY)).toBe(true);
    expect(checkPasscode("wrong")).toBe(false);
    expect(checkPasscode(KEY + "x")).toBe(false);
    expect(checkPasscode(KEY.toUpperCase())).toBe(false);
  });

  it("returns false (no throw) when ADMIN_KEY is unset", () => {
    withAdminKey(undefined);
    expect(() => checkPasscode(KEY)).not.toThrow();
    expect(checkPasscode(KEY)).toBe(false);
  });

  it("never throws on empty or weird input", () => {
    withAdminKey(KEY);
    for (const input of ["", " ", "\0", "\n", "a".repeat(10_000)]) {
      expect(() => checkPasscode(input)).not.toThrow();
      expect(checkPasscode(input)).toBe(false);
    }
  });
});

describe("signSession / verifySession", () => {
  it("signs a `${exp}.${sig}` token that verifies", async () => {
    withAdminKey(KEY);
    const token = await signSession(await deriveSessionSecret(KEY));
    const [exp, sig] = token.split(".");
    expect(Number(exp)).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifySession(token)).toBe(true);
  });

  it("rejects a tampered signature", async () => {
    withAdminKey(KEY);
    const token = await signSession(await deriveSessionSecret(KEY));
    const [exp, sig] = token.split(".");
    const flipped = (sig[0] === "a" ? "b" : "a") + sig.slice(1);
    expect(await verifySession(`${exp}.${flipped}`)).toBe(false);
  });

  it("rejects a tampered expiry (extending it)", async () => {
    withAdminKey(KEY);
    const token = await signSession(await deriveSessionSecret(KEY));
    const [, sig] = token.split(".");
    const extended = Math.floor(Date.now() / 1000) + 999_999;
    expect(await verifySession(`${extended}.${sig}`)).toBe(false);
  });

  it("rejects an expired token", async () => {
    withAdminKey(KEY);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() - (SESSION_TTL_S + 120) * 1000);
    const token = await signSession(await deriveSessionSecret(KEY));
    vi.useRealTimers();
    expect(await verifySession(token)).toBe(false);
  });

  it("rejects undefined, empty and malformed tokens without throwing", async () => {
    withAdminKey(KEY);
    const bad = [
      undefined,
      "",
      "garbage",
      "123",
      "abc.def",
      ".",
      ".abc",
      "abc.",
      "NaN.abc",
      "-1.abc",
      "1.2.3",
      " 12 .abc",
      "0x10.abc",
      "Infinity.abc",
    ];
    for (const token of bad) {
      await expect(verifySession(token)).resolves.toBe(false);
    }
  });

  it("rejects every token when ADMIN_KEY is unset", async () => {
    withAdminKey(KEY);
    const token = await signSession(await deriveSessionSecret(KEY));
    withAdminKey(undefined);
    expect(await verifySession(token)).toBe(false);
  });

  it("does not verify tokens signed with a different key", async () => {
    const secret = await deriveSessionSecret("other-key");
    withAdminKey(KEY);
    expect(await verifySession(await signSession(secret))).toBe(false);
  });
});

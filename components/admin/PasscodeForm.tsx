"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { readJson } from "@/lib/admin/client";
import { t } from "@/lib/i18n/server";
import type { Locale } from "@/lib/types";

/**
 * Login form for POST /api/admin/login (JSON {passcode}). Plain fetch on
 * purpose: a 401 here means "wrong passcode" and must show a message, not
 * trigger the session-expiry redirect that lib/admin/client's adminFetch
 * performs on every other admin call. No captcha or rate-limit UI — the
 * reverse proxy is expected to limit this endpoint; see docs/DEPLOY.md §6
 * (nginx `limit_req` snippet for /api/admin/login).
 */
export function PasscodeForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    if (passcode.length === 0) {
      setError(t("admin.loginFailed", locale));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        // Client navigation still re-runs middleware (the session cookie was
        // just set), so /admin is re-gated server-side on arrival.
        router.push("/admin");
        return;
      }
      const data = await readJson<{ error?: string }>(res);
      // 401 is deliberately generic server-side (no passcode oracle); map it
      // to the localized message. Other statuses (500 ADMIN_KEY not set, 400
      // bad body) carry a useful English error for the self-hosting owner.
      setError(
        res.status === 401
          ? t("admin.loginFailed", locale)
          : data?.error || t("admin.loginFailed", locale),
      );
    } catch {
      setError(t("admin.loginFailed", locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="mt-6 space-y-4">
      <div>
        <label htmlFor="admin-passcode" className="mb-1.5 block text-xs tracking-wide text-blue-ice/70">
          {t("admin.passcode", locale)}
        </label>
        <input
          id="admin-passcode"
          type="password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          autoComplete="off"
          autoFocus
          className="w-full rounded-md border border-blue-ice/15 bg-ink-raised px-3 py-2 text-sm text-blue-ice placeholder:text-blue-ice/40 focus-visible:border-blue-bright/60"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full cursor-pointer rounded-md border border-blue-bright/40 bg-blue-deep/40 px-4 py-2 text-sm text-blue-ice transition-colors duration-300 hover:border-blue-bright/70 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
      >
        {t("admin.login", locale)}
      </button>

      {error !== null && (
        <p role="alert" className="text-xs text-blue-ice">
          {error}
        </p>
      )}
    </form>
  );
}

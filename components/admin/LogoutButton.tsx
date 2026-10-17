"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "@/lib/admin/client";
import { t } from "@/lib/i18n/server";
import type { Locale } from "@/lib/types";

/** Clears the session cookie server-side and lands on the login page. */
export function LogoutButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await adminFetch("/api/admin/logout", { method: "POST" });
    } finally {
      // Whether the call succeeded or the session was already gone, the
      // owner ends up on the login page.
      router.push("/admin/login");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      className="cursor-pointer rounded-md border border-blue-ice/15 px-3 py-1.5 text-xs text-blue-ice/70 transition-colors duration-300 hover:border-blue-ice/40 hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
    >
      {t("admin.logout", locale)}
    </button>
  );
}

"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE } from "@/lib/i18n/server";
import type { Locale } from "@/lib/types";

const MAX_AGE_ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Minimal unstyled zh/en switch (Task 5 owns the visual design):
 * writes the locale cookie, then refreshes the server-rendered tree.
 */
export function LocaleToggle(): JSX.Element {
  const router = useRouter();

  const switchTo = (locale: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${MAX_AGE_ONE_YEAR}; samesite=lax`;
    router.refresh();
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={() => switchTo("zh")}>
        中文
      </button>
      <button type="button" onClick={() => switchTo("en")}>
        English
      </button>
    </span>
  );
}

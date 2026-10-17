import type { Locale } from "@/lib/types";
import zhMessages from "@/messages/zh.json";
import enMessages from "@/messages/en.json";

export const LOCALE_COOKIE = "loo_locale";

const catalogs: Record<Locale, Record<string, string>> = {
  zh: zhMessages,
  en: enMessages,
};

/**
 * Resolve the request locale: loo_locale cookie (exactly 'zh' | 'en') ->
 * accept-language (any token starting with 'zh' means 'zh', otherwise 'en')
 * -> default 'zh'.
 */
export function getLocale(h: Headers): Locale {
  const fromCookie = readLocaleCookie(h.get("cookie"));
  if (fromCookie) return fromCookie;

  const acceptLanguage = h.get("accept-language");
  if (acceptLanguage) {
    const wantsZh = acceptLanguage
      .split(",")
      .some((token) => token.trim().toLowerCase().startsWith("zh"));
    return wantsZh ? "zh" : "en";
  }

  return "zh";
}

/** Translate a flat chrome key; an unknown key resolves to itself. */
export function t(key: string, locale: Locale): string {
  const value = catalogs[locale][key];
  return typeof value === "string" ? value : key;
}

function readLocaleCookie(cookieHeader: string | null): Locale | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name !== LOCALE_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    if (value === "zh" || value === "en") return value;
    return undefined; // present but invalid: fall through to accept-language
  }
  return undefined;
}

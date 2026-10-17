import Link from "next/link";
import { headers } from "next/headers";
import { getLocale, t } from "@/lib/i18n/server";
import type { Locale } from "@/lib/types";

/**
 * Minimal on-brand 404: one quiet localized line and a way home.
 * The root layout is dynamic (it reads headers), so the boundary reads
 * the locale too; the guard keeps a hypothetical static rendering of
 * this boundary from failing, degrading to the default 'zh'.
 */
export default async function NotFound() {
  let locale: Locale = "zh";
  try {
    locale = getLocale(await headers());
  } catch {
    // Static (pre-rendered) context: headers are unavailable.
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-28 md:px-8 md:pt-36">
      <span aria-hidden="true" className="mb-10 block h-px w-12 bg-blue-bright/50" />
      <h1 className="font-serif-cn text-3xl font-light leading-[1.3] text-blue-ice md:text-4xl">
        {t("notFound.title", locale)}
      </h1>
      <p className="mt-6 text-base leading-relaxed text-blue-ice/55">
        {t("notFound.hint", locale)}
      </p>
      <Link
        href="/"
        className="mt-12 inline-block text-sm text-blue-ice/70 underline decoration-blue-bright/40 underline-offset-4 transition-colors hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        {t("nav.home", locale)}
      </Link>
    </main>
  );
}

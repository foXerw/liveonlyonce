import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import { resolveText } from "@/lib/content/parse";
import { t } from "@/lib/i18n/server";
import type { Locale } from "@/lib/types";

/**
 * Site-wide footer: identity + the two public destinations (about, mailto)
 * and the deployer's own closing line. Server component — nothing here
 * needs JS. Deliberately no admin entry point: the private corner stays
 * unlinked in public chrome.
 */
export function SiteFooter({ locale }: { locale: Locale }) {
  return (
    <footer className="mt-24 border-t border-blue-ice/[0.06]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-12 md:flex-row md:items-start md:justify-between md:px-8">
        <div className="flex flex-col gap-4">
          <Link
            href="/"
            className="font-serif-cn text-sm tracking-[0.06em] text-blue-ice/80 transition-colors hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {siteConfig.siteName}
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/about"
              className="text-blue-ice/55 transition-colors hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              {t("nav.about", locale)}
            </Link>
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="text-blue-ice/55 transition-colors hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              {siteConfig.contactEmail}
            </a>
          </nav>
        </div>
        <p className="text-sm leading-relaxed text-blue-ice/55">
          {resolveText(siteConfig.footer, locale)}
          <span aria-hidden="true"> · </span>
          {t("footer.builtWith", locale)}
        </p>
      </div>
    </footer>
  );
}

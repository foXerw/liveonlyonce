import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { siteConfig } from "@/lib/config/site";
import { resolveText } from "@/lib/content/parse";
import { LocaleToggle } from "@/lib/i18n/client";
import { getLocale, t } from "@/lib/i18n/server";
import { resolveMetadataBase } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Root metadata is generated per request: the layout already calls headers()
 * for the locale, so metadata can read the same headers without making
 * anything dynamic that wasn't. Pages (see lib/seo.buildPageMetadata) set
 * their own fully-qualified titles; a plain parent title never suffixes
 * children, so there is no template to double up.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = getLocale(await headers());
  return {
    // Absolute origin for sharing: set SITE_URL in deployment; when absent
    // Next resolves against localhost (its dev warning) — fine for self-host.
    metadataBase: resolveMetadataBase(),
    title: siteConfig.siteName,
    description: resolveText(siteConfig.heroNote, locale),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = getLocale(await headers());

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="sticky top-0 z-50 border-b border-blue-ice/[0.06] bg-ink/85 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 md:px-8">
            <Link
              href="/"
              className="font-serif-cn text-base tracking-[0.06em] text-blue-ice/90 transition-colors hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-4"
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
              <span aria-hidden="true" className="h-3 w-px bg-blue-ice/10" />
              {/* Container styling only — LocaleToggle internals are Task 4's. */}
              <span className="[&_button]:cursor-pointer [&_button]:text-xs [&_button]:text-blue-ice/60 [&_button]:transition-colors [&_button:hover]:text-blue-ice/90 [&_button+button]:ml-2 [&_button+button]:border-l [&_button+button]:border-blue-ice/15 [&_button+button]:pl-2">
                <LocaleToggle />
              </span>
            </nav>
          </div>
        </header>
        {children}
        <SiteFooter locale={locale} />
      </body>
    </html>
  );
}

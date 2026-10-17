import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { siteConfig } from "@/lib/config/site";
import { LocaleToggle } from "@/lib/i18n/client";
import { getLocale, t } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: siteConfig.siteName,
  description: "Self-hosted life moments",
};

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
        {/* Placeholder top bar; Task 5 owns the real header design. */}
        <header className="flex items-center justify-between px-6 py-4">
          <Link href="/">{siteConfig.siteName}</Link>
          <nav className="flex items-center gap-4">
            <Link href="/about">{t("nav.about", locale)}</Link>
            <LocaleToggle />
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}

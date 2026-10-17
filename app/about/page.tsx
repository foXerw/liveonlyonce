import type { Metadata } from "next";
import { headers } from "next/headers";
import { siteConfig } from "@/lib/config/site";
import { resolveText } from "@/lib/content/parse";
import { getLocale, t } from "@/lib/i18n/server";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = getLocale(await headers());
  return buildPageMetadata({
    title: t("about.title", locale),
    description: resolveText(siteConfig.about, locale),
  });
}

/**
 * The public explanation of the site: what it is (siteConfig.about, written
 * by the deployer), an echo of the hero line, and a way to get in touch.
 * Server component, no JS — every deployer's visitors should understand
 * this place in two quiet sentences.
 */
export default async function AboutPage() {
  const locale = getLocale(await headers());

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-16 md:px-8 md:pt-24">
      <span aria-hidden="true" className="mb-10 block h-px w-12 bg-blue-bright/50" />
      <h1 className="font-serif-cn text-3xl font-light leading-[1.3] text-blue-ice md:text-4xl">
        {t("about.title", locale)}
      </h1>
      <p className="mt-8 text-base leading-relaxed text-blue-ice/55 md:text-lg">
        {resolveText(siteConfig.about, locale)}
      </p>
      <p className="mt-14 font-serif-cn text-xl font-light leading-relaxed text-blue-ice/85 md:text-2xl">
        {resolveText(siteConfig.heroLine, locale)}
      </p>
      <p className="mt-14 text-sm leading-relaxed text-blue-ice/55">
        <a
          href={`mailto:${siteConfig.contactEmail}`}
          className="underline decoration-blue-bright/40 underline-offset-4 transition-colors hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {siteConfig.contactEmail}
        </a>
      </p>
    </main>
  );
}

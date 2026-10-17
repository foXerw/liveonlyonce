import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumStory } from "@/components/detail/AlbumStory";
import { FeatureMoment } from "@/components/detail/FeatureMoment";
import { TextEssay } from "@/components/detail/TextEssay";
import { contentDir } from "@/lib/content/dir";
import { findMoment } from "@/lib/content/loader";
import { resolveText } from "@/lib/content/parse";
import { layoutFor } from "@/lib/detail/layoutFor";
import { getLocale, t } from "@/lib/i18n/server";
import { buildPageMetadata } from "@/lib/seo";

/**
 * Shareable metadata for a moment: resolved title/description in the
 * request locale, og:image pointing at the poster (first image) served at
 * the 1280 tier. Unknown ids fall back to the root (notFound) metadata.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const moment = await findMoment(contentDir(), id);
  if (!moment) return {};

  const locale = getLocale(await headers());
  return buildPageMetadata({
    title: resolveText(moment.title, locale),
    description: resolveText(moment.description, locale),
    imageFile: moment.poster?.file,
    momentId: moment.poster ? moment.id : undefined,
  });
}

export default async function MomentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const moment = await findMoment(contentDir(), id);
  if (!moment) notFound();
  const locale = getLocale(await headers());
  const layout = layoutFor(moment);

  return (
    <main>
      {/* The back link shares the narrative's left edge: the wide site
          container for story/feature, the narrow reading column for essay. */}
      <div
        className={`mx-auto w-full px-5 pt-10 md:px-8 md:pt-14 ${
          layout === "essay" ? "max-w-2xl" : "max-w-6xl"
        }`}
      >
        <Link
          href="/"
          className="group inline-flex items-center gap-2.5 text-sm text-blue-ice/55 transition-colors hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className="transition-transform duration-300 group-hover:-translate-x-0.5"
          >
            <path
              d="M9.5 2.5 4 8l5.5 5.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("detail.back", locale)}
        </Link>
      </div>

      {layout === "story" && <AlbumStory moment={moment} locale={locale} />}
      {layout === "feature" && <FeatureMoment moment={moment} locale={locale} />}
      {layout === "essay" && <TextEssay moment={moment} locale={locale} />}
    </main>
  );
}

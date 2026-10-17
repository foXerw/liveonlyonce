import Image from "next/image";
import Link from "next/link";
import { resolveText } from "@/lib/content/parse";
import { t } from "@/lib/i18n/server";
import { assetUrl } from "@/lib/media/url";
import type { Locale, Moment } from "@/lib/types";
import { MomentLightboxTrigger } from "@/components/MomentLightbox";
import { MomentMeta } from "@/components/timeline/MomentMeta";

export interface PhotoCardProps {
  moment: Moment;
  locale: Locale;
  priority?: boolean;
}

/**
 * Single-image moment: a square-ish crop, quiet and direct — one photo,
 * one caption, nothing else. A plain left click opens the photo in the
 * lightbox (Task 6) instead of navigating; the link still leads to the
 * detail page for no-JS visitors, modifier clicks and "open in new tab".
 */
export function PhotoCard({ moment, locale, priority }: PhotoCardProps) {
  const poster = moment.poster;
  const title = resolveText(moment.title, locale);
  const description = resolveText(moment.description, locale);
  if (!poster) return null; // selectCard only yields 'photo' when a poster exists

  return (
    <MomentLightboxTrigger
      images={[
        {
          src: assetUrl(moment.id, poster.file, 1920),
          alt: title,
          width: poster.width,
          height: poster.height,
        },
      ]}
      labels={{
        title: t("lightbox.title", locale),
        close: t("lightbox.close", locale),
        prev: t("lightbox.prev", locale),
        next: t("lightbox.next", locale),
      }}
    >
      <Link
        href={`/moments/${moment.id}`}
        data-card="photo"
        aria-haspopup="dialog"
        className="group flex w-full flex-col overflow-hidden rounded-xs border border-blue-ice/10 bg-ink-raised transition-colors duration-500 hover:border-blue-bright/40 focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <div className="aspect-square w-full overflow-hidden bg-blue-deep/25">
          <Image
            src={assetUrl(moment.id, poster.file, 1280)}
            width={poster.width}
            height={poster.height}
            alt={title}
            sizes="(min-width: 768px) 38vw, 84vw"
            priority={priority}
            className="size-full object-cover brightness-[0.92] transition-[transform,filter] duration-700 ease-out group-hover:scale-[1.02] group-hover:brightness-100"
          />
        </div>
        <div className="p-5 md:p-6">
          <h3 className="font-serif-cn text-lg leading-snug text-blue-ice md:text-xl">
            {title}
          </h3>
          {description && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-blue-ice/55">
              {description}
            </p>
          )}
          <MomentMeta moment={moment} locale={locale} />
        </div>
      </Link>
    </MomentLightboxTrigger>
  );
}

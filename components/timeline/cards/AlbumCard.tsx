import Image from "next/image";
import Link from "next/link";
import { resolveText } from "@/lib/content/parse";
import { assetUrl } from "@/lib/media/url";
import type { Locale, Moment } from "@/lib/types";
import { MomentMeta } from "@/components/timeline/MomentMeta";

export interface AlbumCardProps {
  moment: Moment;
  locale: Locale;
  priority?: boolean;
}

/**
 * Multi-image album with a wide/square poster: landscape 16:9 crop, the
 * broadest card in the timeline. Links to the moment detail page.
 */
export function AlbumCard({ moment, locale, priority }: AlbumCardProps) {
  const poster = moment.poster;
  const title = resolveText(moment.title, locale);
  const description = resolveText(moment.description, locale);
  if (!poster) return null; // selectCard only yields 'album' when a poster exists

  return (
    <Link
      href={`/moments/${moment.id}`}
      data-card="album"
      className="group flex w-full flex-col overflow-hidden rounded-xs border border-blue-ice/10 bg-ink-raised transition-colors duration-500 hover:border-blue-bright/40 focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <div className="aspect-video w-full overflow-hidden bg-blue-deep/25">
        <Image
          src={assetUrl(moment.id, poster.file, 1280)}
          width={poster.width}
          height={poster.height}
          alt={title}
          sizes="(min-width: 768px) 40vw, 84vw"
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
  );
}

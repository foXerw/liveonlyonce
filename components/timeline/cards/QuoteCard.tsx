import Link from "next/link";
import { resolveText } from "@/lib/content/parse";
import type { Locale, Moment } from "@/lib/types";
import { MomentMeta } from "@/components/timeline/MomentMeta";

export interface QuoteCardProps {
  moment: Moment;
  locale: Locale;
}

/**
 * Text-only moment: no image — the words are the visual. Set in the serif
 * display face with generous leading and air, on a faintly blue-tinted
 * ground so it reads as a different species from the photo cards.
 */
export function QuoteCard({ moment, locale }: QuoteCardProps) {
  const title = resolveText(moment.title, locale);
  const description = resolveText(moment.description, locale);

  return (
    <Link
      href={`/moments/${moment.id}`}
      data-card="quote"
      className="group flex w-full flex-col rounded-xs border border-blue-deep/80 bg-blue-deep/10 px-6 py-10 transition-colors duration-500 hover:border-blue-bright/40 focus-visible:outline-2 focus-visible:outline-offset-4 md:px-8 md:py-12"
    >
      <span
        aria-hidden="true"
        className="mb-7 block h-px w-8 bg-blue-bright/60 transition-all duration-500 group-hover:w-12"
      />
      <h3 className="font-serif-cn text-xl font-light leading-relaxed text-blue-ice/95 md:text-[1.65rem] md:leading-[1.7]">
        {title}
      </h3>
      {description && (
        <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-blue-ice/55">
          {description}
        </p>
      )}
      <div className="mt-auto pt-8">
        <MomentMeta moment={moment} locale={locale} />
      </div>
    </Link>
  );
}

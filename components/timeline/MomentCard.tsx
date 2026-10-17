import type { Locale, Moment } from "@/lib/types";
import { selectCard } from "@/lib/timeline/selectCard";
import { AlbumCard } from "@/components/timeline/cards/AlbumCard";
import { PhotoCard } from "@/components/timeline/cards/PhotoCard";
import { PosterCard } from "@/components/timeline/cards/PosterCard";
import { QuoteCard } from "@/components/timeline/cards/QuoteCard";

export interface MomentCardProps {
  moment: Moment;
  locale: Locale;
  /** Only the first card of the page (hero-adjacent) loads eagerly. */
  priority?: boolean;
  /** Task 6 wires this to the lightbox for photo cards; safe to omit. */
  onOpenLightbox?: () => void;
}

/**
 * Dispatches a moment to its type-adaptive card. Server component — the
 * cards carry no interactivity of their own (motion lives in Reveal).
 */
export function MomentCard({
  moment,
  locale,
  priority,
  onOpenLightbox,
}: MomentCardProps) {
  switch (selectCard(moment)) {
    case "album":
      return <AlbumCard moment={moment} locale={locale} priority={priority} />;
    case "poster":
      return <PosterCard moment={moment} locale={locale} priority={priority} />;
    case "photo":
      return (
        <PhotoCard
          moment={moment}
          locale={locale}
          priority={priority}
          onOpenLightbox={onOpenLightbox}
        />
      );
    case "quote":
      return <QuoteCard moment={moment} locale={locale} />;
  }
}

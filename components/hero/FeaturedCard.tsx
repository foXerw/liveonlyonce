import { t } from "@/lib/i18n/server";
import type { Locale, Moment } from "@/lib/types";
import { MomentCard } from "@/components/timeline/MomentCard";
import { Reveal } from "@/components/motion/Reveal";

/**
 * The newest pinned moment, placed between hero and timeline as the page's
 * one curated pick (ruling R9) — the timeline itself stays strictly
 * chronological. Reuses the card visual language via MomentCard; the diamond
 * eyebrow label is the pinned-badge detail, and the card meta repeats the
 * pinned marker. Links to the moment detail page through the dispatched card.
 */
export function FeaturedCard({
  moment,
  locale,
}: {
  moment: Moment;
  locale: Locale;
}) {
  return (
    <section
      aria-label={t("home.featured", locale)}
      className="mx-auto mb-20 w-full max-w-6xl px-5 md:mb-28 md:px-8"
    >
      <Reveal>
        <p className="mb-6 flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-blue-bright/85">
          <span
            aria-hidden="true"
            className="size-[6px] rotate-45 border border-blue-bright/70"
          />
          {t("home.featured", locale)}
        </p>
        <div className="max-w-3xl">
          <MomentCard moment={moment} locale={locale} priority />
        </div>
      </Reveal>
    </section>
  );
}

import { t } from "@/lib/i18n/server";
import type { Locale, YearGroup } from "@/lib/types";
import { MomentCard } from "@/components/timeline/MomentCard";
import { Reveal } from "@/components/motion/Reveal";
import { YearMarker } from "@/components/timeline/YearMarker";

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Vertical center-axis timeline (desktop): year markers interrupt the axis,
 * cards alternate sides with an offset rhythm so rows never read like a
 * table. On mobile the axis drops away and each moment keeps a single quiet
 * node beside a one-column stack.
 */
export function Timeline({
  groups,
  locale,
}: {
  groups: YearGroup[];
  locale: Locale;
}) {
  const total = groups.reduce((sum, group) => sum + group.moments.length, 0);
  const firstId = groups[0]?.moments[0]?.id;
  let running = 0;

  return (
    <section className="relative mx-auto w-full max-w-6xl px-5 pb-28 md:px-8 md:pb-36">
      {groups.map((group) => (
        <div key={group.year} className="mt-14 first:mt-0 md:mt-20 md:first:mt-0">
          <YearMarker year={group.year} />
          <ul>
            {group.moments.map((moment) => {
              const index = running++;
              const left = index % 2 === 0;
              return (
                <li
                  key={moment.id}
                  className={cx(
                    "relative mb-12 grid grid-cols-[auto_1fr] items-start gap-x-5 last:mb-0 md:grid-cols-2 md:gap-x-16 md:last:mb-0",
                    // Asymmetric rhythm: the two sides breathe at different
                    // distances, so rows never line up like a table.
                    left ? "md:mb-16" : "md:mb-24",
                  )}
                >
                  {/* Node: leading column on mobile, on the axis on desktop. */}
                  <span
                    aria-hidden="true"
                    className="relative z-10 mt-1 flex size-4 shrink-0 items-center justify-center md:absolute md:left-1/2 md:top-1 md:mt-0 md:-translate-x-1/2"
                  >
                    <span className="size-[9px] rounded-full border border-blue-bright/60 bg-ink shadow-[0_0_14px_var(--color-blue-glow)]" />
                  </span>

                  {/* Hairline leader from node toward the card (desktop). */}
                  <span
                    aria-hidden="true"
                    className={cx(
                      "absolute top-3 hidden h-px w-[calc(2rem-13px)] bg-blue-deep md:block",
                      left ? "md:right-[calc(50%+7px)]" : "md:left-[calc(50%+7px)]",
                    )}
                  />

                  <Reveal
                    delay={left ? 0 : 0.08}
                    className={cx(
                      "col-start-2 w-full md:flex md:w-full",
                      left ? "md:col-start-1 md:justify-end" : "md:col-start-2 md:justify-start",
                    )}
                  >
                    <MomentCard
                      moment={moment}
                      locale={locale}
                      priority={moment.id === firstId}
                    />
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* A young site (≤ 3 moments) closes on the invitation to begin. */}
      {total <= 3 && (
        <Reveal>
          <div className="relative pt-16 text-center md:pt-24">
            <span
              aria-hidden="true"
              className="mx-auto mb-7 block size-[7px] rotate-45 border border-blue-bright/50"
            />
            <p className="font-serif-cn text-lg font-light tracking-wide text-blue-ice/70 md:text-xl">
              {t("timeline.storyStart", locale)}
            </p>
            <span
              aria-hidden="true"
              className="mx-auto mt-9 block h-px w-14 bg-blue-deep"
            />
          </div>
        </Reveal>
      )}

      {/* Center axis, fading out at both ends. Kept last in the DOM so the
          first year group above is the section's :first-child. */}
      <div
        aria-hidden="true"
        className="absolute inset-y-6 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-blue-deep/0 via-blue-deep to-blue-deep/0 md:block"
      />
    </section>
  );
}

import { siteConfig } from "@/lib/config/site";
import { resolveText } from "@/lib/content/parse";
import type { Locale } from "@/lib/types";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Opening statement: heroLine (large) + heroNote (small), both localized.
 * Black ground with a faint blue glow at the top edge — no numbers, no
 * counters, no slogans. The copy itself carries the manifesto.
 */
export function Hero({ locale }: { locale: Locale }) {
  return (
    <section className="relative overflow-hidden">
      {/* Faint blue halo sinking into the ink; references the glow token. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(58%_100%_at_50%_-10%,var(--color-blue-glow),transparent_72%)] opacity-70"
      />
      <div className="relative mx-auto w-full max-w-6xl px-5 pb-20 pt-20 md:px-8 md:pb-28 md:pt-32">
        <Reveal>
          <span
            aria-hidden="true"
            className="mb-10 block h-px w-12 bg-blue-bright/50"
          />
          <h1 className="max-w-[18ch] font-serif-cn text-4xl font-light leading-[1.25] text-blue-ice md:max-w-[20ch] md:text-6xl md:leading-[1.2]">
            {resolveText(siteConfig.heroLine, locale)}
          </h1>
          <p className="mt-7 max-w-[32ch] text-sm leading-relaxed text-blue-ice/55 md:mt-8 md:text-base">
            {resolveText(siteConfig.heroNote, locale)}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

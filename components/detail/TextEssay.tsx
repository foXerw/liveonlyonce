import { resolveText } from "@/lib/content/parse";
import type { Locale, Moment } from "@/lib/types";
import { DetailEnd, DetailMeta } from "@/components/detail/DetailMeta";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Text-only moment: a focused reading layout — narrow serif column, the
 * opening paragraph set at display size, the rest as calm body text. The
 * description is split on blank lines/newlines into paragraphs; the first
 * one carries the display-size opening line.
 */
export function TextEssay({
  moment,
  locale,
}: {
  moment: Moment;
  locale: Locale;
}) {
  const title = resolveText(moment.title, locale);
  const [opening, ...body] = splitParagraphs(
    resolveText(moment.description, locale),
  );

  return (
    <article data-layout="essay" className="pb-24 md:pb-32">
      <div className="mx-auto w-full max-w-2xl px-5 md:px-8">
        <header className="pt-8 md:pt-10">
          <DetailMeta moment={moment} locale={locale} />
          <h1 className="mt-5 font-serif-cn text-2xl font-light leading-snug text-blue-ice md:text-4xl md:leading-[1.3]">
            {title}
          </h1>
        </header>

        {opening && (
          <Reveal className="mt-12 md:mt-16">
            <p className="font-serif-cn text-xl font-light leading-relaxed text-blue-ice/95 md:text-3xl md:leading-[1.55]">
              {opening}
            </p>
          </Reveal>
        )}

        {body.map((paragraph, i) => (
          <Reveal key={`p-${i}`} className="mt-8">
            <p className="font-serif-cn text-base font-light leading-loose text-blue-ice/75 md:text-lg">
              {paragraph}
            </p>
          </Reveal>
        ))}

        <DetailEnd />
      </div>
    </article>
  );
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\r?\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

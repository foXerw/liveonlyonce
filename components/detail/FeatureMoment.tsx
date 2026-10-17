import Image from "next/image";
import { classifyAspect, resolveText } from "@/lib/content/parse";
import { assetUrl } from "@/lib/media/url";
import type { AspectClass, Locale, Moment } from "@/lib/types";
import { DetailEnd, DetailMeta } from "@/components/detail/DetailMeta";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Single-image moment: one large featured plate (1920 tier, eager — it *is*
 * the page) with the title above and the reflection set as a quiet serif
 * caption below. The frame width adapts to the image's aspect so tall shots
 * read as portraits instead of towering over the fold.
 */
export function FeatureMoment({
  moment,
  locale,
}: {
  moment: Moment;
  locale: Locale;
}) {
  const title = resolveText(moment.title, locale);
  const description = resolveText(moment.description, locale);
  const image = moment.poster ?? moment.images[0];
  if (!image) return null; // kind 'photo' implies exactly one image

  const aspect = classifyAspect(image.width, image.height);

  return (
    <article data-layout="feature" className="pb-24 md:pb-32">
      <header className="mx-auto w-full max-w-6xl px-5 pt-8 md:px-8 md:pt-10">
        <DetailMeta moment={moment} locale={locale} />
        <h1 className="mt-5 max-w-[16ch] font-serif-cn text-3xl font-light leading-[1.25] text-blue-ice md:text-5xl md:leading-[1.2]">
          {title}
        </h1>
      </header>

      <div className="mx-auto mt-10 w-full max-w-6xl px-5 md:mt-14 md:px-8">
        <figure className={FEATURE_WIDTH[aspect]}>
          <div className="overflow-hidden rounded-xs bg-blue-deep/25">
            <Image
              src={assetUrl(moment.id, image.file, 1920)}
              width={image.width}
              height={image.height}
              alt={title}
              sizes={FEATURE_SIZES[aspect]}
              priority
              className="h-auto w-full"
            />
          </div>
          {description && (
            <figcaption className="mt-8 max-w-[36em] md:mt-10">
              <Reveal mode="load">
                <p className="font-serif-cn text-lg font-light leading-loose text-blue-ice/85 md:text-xl">
                  {description}
                </p>
              </Reveal>
            </figcaption>
          )}
        </figure>
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <DetailEnd />
      </div>
    </article>
  );
}

const FEATURE_WIDTH: Record<AspectClass, string> = {
  wide: "",
  square: "mx-auto w-full max-w-3xl",
  tall: "mx-auto w-full max-w-sm md:max-w-md",
};

const FEATURE_SIZES: Record<AspectClass, string> = {
  wide: "(min-width: 768px) calc(100vw - 4rem), calc(100vw - 2.5rem)",
  square: "(min-width: 768px) min(48rem, calc(100vw - 4rem)), calc(100vw - 2.5rem)",
  tall: "(min-width: 768px) min(28rem, calc(100vw - 4rem)), calc(100vw - 2.5rem)",
};

import Image from "next/image";
import { classifyAspect, resolveText } from "@/lib/content/parse";
import { assetUrl } from "@/lib/media/url";
import type { AspectClass, Locale, Moment, MomentImage } from "@/lib/types";
import { DetailEnd, DetailMeta } from "@/components/detail/DetailMeta";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Immersive scroll narrative for albums: an eager opening plate, the
 * reflection interleaved between the images, then the remaining plates in a
 * calm vertical rhythm. Motion is CSS-first (Task 5's binding lesson): each
 * plate drifts a couple of percent against its frame via a scroll-driven
 * animation (.story-drift, @supports-gated, transform-only, neutralized for
 * reduced motion and print) — no client JS, nothing hidden pending scripts.
 *
 * Loading discipline (a 30+ image album must not load eagerly): exactly the
 * opening plate is `priority`; every other plate is explicit `loading="lazy"`
 * at the 1920 tier with aspect-appropriate `sizes`.
 */
export function AlbumStory({
  moment,
  locale,
}: {
  moment: Moment;
  locale: Locale;
}) {
  const title = resolveText(moment.title, locale);
  const description = resolveText(moment.description, locale);
  const [opening, ...rest] = moment.images;
  if (!opening) return null; // kind 'album' implies 2+ images; guard for safety

  return (
    <article data-layout="story" className="pb-24 md:pb-32">
      <header className="mx-auto w-full max-w-6xl px-5 pt-8 md:px-8 md:pt-10">
        <DetailMeta moment={moment} locale={locale} />
        <h1 className="mt-5 max-w-[16ch] font-serif-cn text-3xl font-light leading-[1.25] text-blue-ice md:text-5xl md:leading-[1.2]">
          {title}
        </h1>
      </header>

      <figure className="mx-auto mt-10 w-full max-w-6xl px-5 md:mt-14 md:px-8">
        <Plate
          momentId={moment.id}
          image={opening}
          title={title}
          position={1}
          count={moment.images.length}
          priority
        />
      </figure>

      {description && (
        <Reveal className="mx-auto mt-16 w-full max-w-6xl px-5 md:mt-24 md:px-8">
          <p className="max-w-[36em] font-serif-cn text-lg font-light leading-loose text-blue-ice/85 md:text-xl">
            {description}
          </p>
        </Reveal>
      )}

      {rest.map((image, i) => (
        <figure
          key={image.file}
          className="mx-auto mt-16 w-full max-w-6xl px-5 md:mt-24 md:px-8"
        >
          <Plate
            momentId={moment.id}
            image={image}
            title={title}
            position={i + 2}
            count={moment.images.length}
          />
        </figure>
      ))}

      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <DetailEnd />
      </div>
    </article>
  );
}

const PLATE_WIDTH: Record<AspectClass, string> = {
  // Wide plates span the container; square and tall ones pull in so they
  // never tower over the reading rhythm.
  wide: "",
  square: "mx-auto w-full max-w-3xl",
  tall: "mx-auto w-full max-w-sm md:max-w-md",
};

const PLATE_SIZES: Record<AspectClass, string> = {
  wide: "(min-width: 768px) calc(100vw - 4rem), calc(100vw - 2.5rem)",
  square: "(min-width: 768px) min(48rem, calc(100vw - 4rem)), calc(100vw - 2.5rem)",
  tall: "(min-width: 768px) min(28rem, calc(100vw - 4rem)), calc(100vw - 2.5rem)",
};

function Plate({
  momentId,
  image,
  title,
  position,
  count,
  priority,
}: {
  momentId: string;
  image: MomentImage;
  title: string;
  position: number;
  count: number;
  priority?: boolean;
}) {
  const aspect = classifyAspect(image.width, image.height);
  return (
    <div className={PLATE_WIDTH[aspect]}>
      <div className="overflow-hidden rounded-xs bg-blue-deep/25">
        <Image
          src={assetUrl(momentId, image.file, 1920)}
          width={image.width}
          height={image.height}
          alt={`${title} · ${position}/${count}`}
          sizes={PLATE_SIZES[aspect]}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          className="story-drift h-auto w-full scale-105"
        />
      </div>
    </div>
  );
}

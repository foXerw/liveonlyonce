import { resolveText } from "@/lib/content/parse";
import type { Locale, Moment } from "@/lib/types";

/**
 * Shared detail-page chrome. DetailMeta is the timeline MomentMeta's sibling
 * for detail pages: same quiet tokens, but it carries the full date (the
 * year has no marker here to absorb it) and no pinned badge — pinning is a
 * homepage curation detail, not part of a moment's own story. DetailEnd is
 * the closing gesture echoing the homepage's "story starts here" mark.
 */
export function DetailMeta({
  moment,
  locale,
}: {
  moment: Moment;
  locale: Locale;
}) {
  const location = moment.location ? resolveText(moment.location, locale) : "";
  return (
    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs tracking-wide text-blue-ice/60">
      <time dateTime={moment.date}>{formatFullDate(moment.date, locale)}</time>
      {location && (
        <>
          <Dot />
          <span>{location}</span>
        </>
      )}
    </p>
  );
}

export function DetailEnd() {
  return (
    <div
      aria-hidden="true"
      className="mt-24 flex flex-col items-center gap-6 md:mt-32"
    >
      <span className="size-[7px] rotate-45 border border-blue-bright/50" />
      <span className="h-px w-14 bg-blue-deep" />
    </div>
  );
}

// Mirrors MomentMeta's private separator — the same 3px token dot.
function Dot() {
  return (
    <span aria-hidden="true" className="size-[3px] rounded-full bg-blue-ice/25" />
  );
}

function formatFullDate(date: string, locale: Locale): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

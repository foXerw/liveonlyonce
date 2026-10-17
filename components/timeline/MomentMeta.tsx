import { resolveText } from "@/lib/content/parse";
import { t } from "@/lib/i18n/server";
import type { Locale, Moment } from "@/lib/types";

/**
 * Shared card footer line: quiet pinned label (when pinned) · localized
 * month-day · location. The year lives in the year marker, so cards only
 * carry the month and day.
 */
export function MomentMeta({
  moment,
  locale,
}: {
  moment: Moment;
  locale: Locale;
}) {
  const location = moment.location ? resolveText(moment.location, locale) : "";
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs tracking-wide text-blue-ice/60">
      {moment.pinned && (
        <>
          <span className="text-[11px] tracking-[0.18em] text-blue-bright/85">
            {t("card.pinned", locale)}
          </span>
          <Dot />
        </>
      )}
      <time dateTime={moment.date}>{formatMonthDay(moment.date, locale)}</time>
      {location && (
        <>
          <Dot />
          <span>{location}</span>
        </>
      )}
    </p>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="size-[3px] rounded-full bg-blue-ice/25" />
  );
}

function formatMonthDay(date: string, locale: Locale): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

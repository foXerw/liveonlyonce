/**
 * Quiet typographic anchor for a year group. On mobile it reads as an index
 * entry (year + hairline rule); on desktop it sits centered on the axis, its
 * ink background interrupting the line like a date engraved on a rail.
 */
export function YearMarker({ year }: { year: number }) {
  return (
    <div className="relative mb-10 flex items-center gap-5 md:mb-14 md:block md:text-center">
      <h2 className="font-serif-cn text-[1.75rem] font-light tracking-[0.08em] text-blue-ice/75 tabular-nums md:relative md:z-10 md:inline-block md:bg-ink md:px-7 md:text-4xl">
        {year}
      </h2>
      <span
        aria-hidden="true"
        className="h-px flex-1 bg-gradient-to-r from-blue-deep to-blue-deep/0 md:hidden"
      />
    </div>
  );
}

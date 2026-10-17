import { headers } from "next/headers";
import { Hero } from "@/components/hero/Hero";
import { Timeline } from "@/components/timeline/Timeline";
import { contentDir } from "@/lib/content/dir";
import { groupByYear, loadMoments } from "@/lib/content/loader";
import { getLocale } from "@/lib/i18n/server";
import type { Moment } from "@/lib/types";

export default async function Home() {
  const locale = getLocale(await headers());
  const moments = await loadMoments(contentDir());
  const groups = groupByYear(pinnedFirst(moments));

  return (
    <main>
      <Hero locale={locale} />
      <Timeline groups={groups} locale={locale} />
    </main>
  );
}

/**
 * Stable second sort on top of loadMoments' date-desc order (page-level,
 * per the Task 5 brief): pinned moments first, all others keep their
 * relative order. Array.prototype.sort is stable, so this is all it takes.
 */
function pinnedFirst(moments: Moment[]): Moment[] {
  return [...moments].sort((a, b) => Number(b.pinned) - Number(a.pinned));
}

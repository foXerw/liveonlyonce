import { headers } from "next/headers";
import { FeaturedCard } from "@/components/hero/FeaturedCard";
import { Hero } from "@/components/hero/Hero";
import { Timeline } from "@/components/timeline/Timeline";
import { contentDir } from "@/lib/content/dir";
import { groupByYear, loadMoments } from "@/lib/content/loader";
import { getLocale } from "@/lib/i18n/server";

export default async function Home() {
  const locale = getLocale(await headers());
  // Ruling R9: the timeline keeps loadMoments' strict date-desc order — no
  // pinned re-sort. The newest pinned moment (list is date-desc, so the
  // first pinned found) is lifted into a featured placement above the
  // timeline instead; it still appears in the timeline as well.
  const moments = await loadMoments(contentDir());
  const featured = moments.find((moment) => moment.pinned) ?? null;
  const groups = groupByYear(moments);

  return (
    <main>
      <Hero locale={locale} />
      {featured && <FeaturedCard moment={featured} locale={locale} />}
      <Timeline
        groups={groups}
        locale={locale}
        // The eager image is whatever sits closest to the hero: the featured
        // card when present (it loads its own image with priority), else the
        // timeline's first card.
        priorityId={featured ? undefined : groups[0]?.moments[0]?.id}
      />
    </main>
  );
}

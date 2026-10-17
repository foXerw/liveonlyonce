// Generates on-disk test fixtures (tests/fixtures/content) and example content
// (content-example) for LiveOnlyOnce. Every moment is a folder of gradient PNGs
// + a moment.yaml. Re-running wipes and regenerates the target directories.
//
// Usage: node scripts/make-fixtures.mjs [fixtures|examples|all]
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Write a deterministic horizontal+vertical gradient PNG. */
async function gradientPng(file, width, height, from, to) {
  const channels = 3;
  const buf = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = (x / (width - 1) + y / (height - 1)) / 2;
      const i = (y * width + x) * channels;
      buf[i] = Math.round(from[0] + (to[0] - from[0]) * t);
      buf[i + 1] = Math.round(from[1] + (to[1] - from[1]) * t);
      buf[i + 2] = Math.round(from[2] + (to[2] - from[2]) * t);
    }
  }
  await sharp(buf, { raw: { width, height, channels } }).png().toFile(file);
}

const BLUE = [40, 90, 160];
const TEAL = [20, 160, 150];
const AMBER = [230, 150, 40];
const PLUM = [110, 40, 130];
const SLATE = [70, 80, 95];
const SAND = [225, 200, 160];
const ROSE = [220, 110, 120];

const FIXTURES = [
  {
    dir: "2025-08-15-qinghai-grand-loop",
    yaml: `date: 2025-08-15
pinned: true
title:
  zh: 青甘大环线
  en: Qinghai Grand Loop
description:
  zh: 七天两千公里，从青海湖到敦煌。
  en: Two thousand kilometres in seven days, from Qinghai Lake to Dunhuang.
location:
  zh: 青海·甘肃
  en: Qinghai & Gansu, China
`,
    images: [
      { file: "01-lake-sunrise.png", width: 1600, height: 900, from: BLUE, to: SAND },
      { file: "02-dunes-noon.png", width: 1000, height: 1000, from: AMBER, to: PLUM },
      { file: "03-flagpole.png", width: 800, height: 1600, from: TEAL, to: SLATE },
      { file: "04-sky-mirror.png", width: 1200, height: 800, from: SLATE, to: TEAL },
    ],
  },
  {
    dir: "2026-02-14-morning-run",
    yaml: `date: 2026-02-14
title:
  zh: 清晨的第一跑
  en: First Morning Run
description:
  zh: 城市还没醒，跑道已经亮了。
  en: The track was lit before the city woke up.
`,
    images: [{ file: "01-first-light.png", width: 1920, height: 1080, from: PLUM, to: ROSE }],
  },
  {
    dir: "2026-02-14-late-thoughts",
    yaml: `date: 2026-02-14
title:
  zh: 深夜随想
  en: Late Thoughts
description:
  zh: 有些念头只配得上凌晨两点的记录。
  en: Some thoughts deserve nothing better than a 2 a.m. note.
`,
    images: [],
  },
  {
    dir: "2025-11-03-half-grown",
    // Missing English title on purpose (loader must still accept zh-only).
    yaml: `date: 2025-11-03
title:
  zh: 半熟
description:
  zh: 刚好停在将熟未熟的那一格。
`,
    images: [{ file: "01-desk.png", width: 1000, height: 1000, from: SAND, to: BLUE }],
  },
  {
    dir: "2025-05-05-broken-yaml",
    // Unterminated double quote + unclosed flow map: must fail yaml parse.
    yaml: `date: 2025-05-05
title: {zh: "断裂, en: Broken
description: dangling
`,
    images: [],
  },
  {
    dir: "2025-13-99-calendar-ghost",
    // Folder name matches the id shape, but the date cannot exist.
    yaml: `date: 2025-13-99
title:
  zh: 不存在的日子
  en: Impossible Day
`,
    images: [],
  },
];

const EXAMPLES = [
  {
    // Featured showcase: the only pinned moment (FeaturedCard + 置顶 badge).
    // Album of five; the first image (alphabetical) is wide 16:9, which the
    // loader routes to the horizontal AlbumCard.
    dir: "2026-08-02-coastal-highway",
    yaml: `date: 2026-08-02
pinned: true
title:
  zh: 沿海公路的夏天
  en: A Summer on the Coastal Highway
description:
  zh: 车窗只开了一半，海风比音乐先醒过来。有几段路一边是山一边是海，开久了就忘了时间。回程换了条路，顺路看了今年第一场日落。
  en: The window was open halfway, and the sea breeze got to us before the music did. On the stretches with a mountain on one side and the ocean on the other, you stop checking the time. We took a different road home and caught the year's first sunset on the way.
location:
  zh: 南方海岸线
  en: The southern coast
`,
    images: [
      { file: "01-headland.png", width: 1600, height: 900, from: TEAL, to: SAND },
      { file: "02-morning-fog.png", width: 1200, height: 800, from: SLATE, to: SAND },
      { file: "03-long-bridge.png", width: 1440, height: 900, from: BLUE, to: TEAL },
      { file: "04-beach-stop.png", width: 1200, height: 1200, from: SAND, to: AMBER },
      { file: "05-homeward-dusk.png", width: 1600, height: 900, from: PLUM, to: ROSE },
    ],
  },
  {
    // Movie night: a tall poster first (poster = images[0]) plus one still,
    // so the loader classifies it album+tall — the PosterCard showcase.
    dir: "2026-05-16-midnight-screening",
    yaml: `date: 2026-05-16
title:
  zh: 午夜场
  en: The Midnight Screening
description:
  zh: 一个人看的最后一场，片子不算最好，散场后的夜路却刚好把情绪慢慢放平。下次还选这个场次。
  en: The last show of the night, taken alone. Not the best film in the programme, but the quiet walk home evened everything out. Next time, same slot.
location:
  zh: 市区的老影院
  en: The old cinema downtown
`,
    images: [
      { file: "01-poster.png", width: 800, height: 1200, from: PLUM, to: BLUE },
      { file: "02-still.png", width: 1200, height: 800, from: SLATE, to: TEAL },
    ],
  },
  {
    // Single-object milestone: one near-square photo -> PhotoCard (lightbox).
    dir: "2026-09-07-first-badminton-racket",
    yaml: `date: 2026-09-07
title:
  zh: 第一把球拍
  en: My First Badminton Racket
description:
  zh: 看了两周的评测，最后带回家的却是最初没相中的那把。球场有风，先从发球练起。
  en: Two weeks of reviews, and the one that came home was not the one I first had my eye on. There's a draught in the hall; serve practice first.
`,
    images: [{ file: "01-racket.png", width: 1080, height: 1080, from: AMBER, to: SLATE }],
  },
  {
    // Text-only moment: no images -> QuoteCard, the essay/quote path.
    dir: "2026-03-11-note-to-myself",
    yaml: `date: 2026-03-11
title:
  zh: 给自己的备忘
  en: Note to Myself
description:
  zh: |-
    别再把"以后"当成一个保证。
    想见的人这周就约，想学的东西从笨拙的第一小时开始。
    日子是过出来的，不是攒出来的。
  en: |-
    Stop treating "someday" as a guarantee.
    Invite that person this week; begin the new thing with its first, clumsy hour.
    Days are spent, not saved up.
`,
    images: [],
  },
  {
    // Year-end note with a single cool-toned photo; gives the timeline its
    // second year marker so the 2025 grouping is visible next to 2026.
    dir: "2025-12-31-year-in-review",
    yaml: `date: 2025-12-31
title:
  zh: 年终小结
  en: Year in Review
description:
  zh: 今年学到的一件事，是把要紧的事排进日程，而不是等它自己有空。照片不多，话也不急着说。明年继续。
  en: The one thing learned this year — schedule what matters instead of waiting for it to fit itself in. Few photos, nothing said in a hurry. To be continued next year.
location:
  zh: 书桌前
  en: At the desk
`,
    images: [{ file: "01-last-evening.png", width: 1440, height: 1080, from: BLUE, to: SLATE }],
  },
];

const TARGETS = {
  fixtures: { dir: path.join(rootDir, "tests", "fixtures", "content"), moments: FIXTURES },
  examples: { dir: path.join(rootDir, "content-example"), moments: EXAMPLES },
};

async function generate({ dir, moments }) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const moment of moments) {
    const momentDir = path.join(dir, moment.dir);
    await mkdir(momentDir, { recursive: true });
    await writeFile(path.join(momentDir, "moment.yaml"), moment.yaml, "utf8");
    for (const img of moment.images) {
      await gradientPng(path.join(momentDir, img.file), img.width, img.height, img.from, img.to);
    }
  }
  console.log(`generated ${moments.length} moments in ${path.relative(rootDir, dir)}`);
}

const arg = process.argv[2] ?? "all";
const names = arg === "all" ? Object.keys(TARGETS) : [arg];
if (arg !== "all" && !TARGETS[arg]) {
  console.error(`unknown target "${arg}" (expected fixtures|examples|all)`);
  process.exit(1);
}
for (const name of names) await generate(TARGETS[name]);

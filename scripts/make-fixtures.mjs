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
    dir: "2025-08-15-qinghai-grand-loop",
    yaml: `date: 2025-08-15
pinned: true
title:
  zh: 青甘大环线
  en: Qinghai Grand Loop
description:
  zh: 七天两千公里的环线，占位文案，替换成你自己的故事。
  en: Seven days and two thousand kilometres. Placeholder copy — replace it with your own story.
location:
  zh: 青海·甘肃
  en: Qinghai & Gansu, China
`,
    images: [
      { file: "01-salt-lake.png", width: 1600, height: 900, from: BLUE, to: SAND },
      { file: "02-desert-road.png", width: 1200, height: 1200, from: AMBER, to: PLUM },
      { file: "03-prayer-flags.png", width: 800, height: 1600, from: TEAL, to: SLATE },
    ],
  },
  {
    // Movie night: a tall poster first (poster = images[0]) plus one still,
    // so the loader classifies it album+tall — the PosterCard showcase.
    dir: "2025-05-24-night-screen",
    yaml: `date: 2025-05-24
title:
  zh: 夜场电影
  en: Night Screening
description:
  zh: 老片重映，散场走进夜里，觉得街道也温柔了几分。占位短评。
  en: A revival of an old film; walking out into the night, even the streets felt gentler. Placeholder review.
location:
  zh: 老城影院
  en: The old-town cinema
`,
    images: [
      { file: "01-poster.png", width: 800, height: 1200, from: PLUM, to: BLUE },
      { file: "02-still.png", width: 1200, height: 800, from: SLATE, to: TEAL },
    ],
  },
  {
    dir: "2026-04-06-city-harvest",
    yaml: `date: 2026-04-06
title:
  zh: 城市收获日
  en: City Harvest Day
description:
  zh: 一张照片也能讲一个下午。占位文案。
  en: A single photo can carry a whole afternoon. Placeholder copy.
location:
  zh: 家附近
  en: Close to home
`,
    images: [{ file: "01-rooftop.png", width: 1920, height: 1080, from: SLATE, to: ROSE }],
  },
  {
    dir: "2026-09-12-quiet-lines",
    yaml: `date: 2026-09-12
title:
  zh: 安静的句子
  en: Quiet Lines
description:
  zh: 纯文本瞬间：没有照片，只有一段话。占位文案。
  en: A text-only moment — no photos, just a paragraph. Placeholder copy.
`,
    images: [],
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

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { clearContentCache } from "@/lib/content/cache";
import { findMoment, groupByYear, loadMoments } from "@/lib/content/loader";

// Vitest runs from the project root; jsdom import.meta.url is a server URL, not a file URL.
const FIXTURES = path.resolve(process.cwd(), "tests/fixtures/content");

// Smallest valid 1x1 PNG (transparent), used by temp-dir tests.
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const VALID_YAML = `date: 2026-01-02
title:
  zh: 临时
  en: Temporary
`;

function warnedText(): string {
  return warn.mock.calls.map((args: unknown[]) => args.join(" ")).join("\n");
}

let warn: MockInstance;
const tempDirs: string[] = [];

async function tempContentDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "loo-content-"));
  tempDirs.push(dir);
  return dir;
}

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  clearContentCache();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("loadMoments", () => {
  it("returns the valid fixture moments, newest first, skipping malformed folders", async () => {
    const moments = await loadMoments(FIXTURES);

    expect(moments.map((m) => m.id)).toEqual([
      "2026-02-14-morning-run", // date desc, id desc on the 2026-02-14 tie
      "2026-02-14-late-thoughts",
      "2025-11-03-half-grown",
      "2025-08-15-lakeside-circuit",
    ]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warnedText()).toContain("2025-05-05-broken-yaml");
    expect(warnedText()).toContain("2025-13-99-calendar-ghost");
  });

  it("derives kind, images, poster and pinned from the real files", async () => {
    const moments = await loadMoments(FIXTURES);
    const byId = new Map(moments.map((m) => [m.id, m]));

    const album = byId.get("2025-08-15-lakeside-circuit")!;
    expect(album.kind).toBe("album");
    expect(album.pinned).toBe(true);
    expect(album.images.map((i) => i.file)).toEqual([
      "01-lake-sunrise.png",
      "02-dunes-noon.png",
      "03-flagpole.png",
      "04-sky-mirror.png",
    ]);
    expect(album.images[0]).toEqual({ file: "01-lake-sunrise.png", width: 1600, height: 900 });
    expect(album.poster).toEqual(album.images[0]);
    expect(album.posterAspect).toBe("wide");

    const text = byId.get("2026-02-14-late-thoughts")!;
    expect(text.kind).toBe("text");
    expect(text.images).toEqual([]);
    expect(text.poster).toBeNull();
    expect(text.posterAspect).toBeNull();

    const run = byId.get("2026-02-14-morning-run")!;
    expect(run.kind).toBe("photo");
    expect(run.pinned).toBe(false);
    expect(run.posterAspect).toBe("wide"); // 1920x1080

    const halfGrown = byId.get("2025-11-03-half-grown")!;
    expect(halfGrown.title).toEqual({ zh: "半熟" }); // missing English is fine
  });

  it("serves repeat calls from the TTL cache until clearContentCache busts it", async () => {
    const first = await loadMoments(FIXTURES);
    expect(warn).toHaveBeenCalledTimes(2);

    const second = await loadMoments(FIXTURES); // cached: no rescan, no new warnings
    expect(warn).toHaveBeenCalledTimes(2);
    expect(second.map((m) => m.id)).toEqual(first.map((m) => m.id));

    clearContentCache();
    await loadMoments(FIXTURES); // rescans: warns again
    expect(warn).toHaveBeenCalledTimes(4);
  });

  it("skips folders whose name is not a valid moment id", async () => {
    const dir = await tempContentDir();
    await mkdir(path.join(dir, "Not_A_Valid_Name!"), { recursive: true });
    await writeFile(path.join(dir, "Not_A_Valid_Name!", "moment.yaml"), VALID_YAML);

    expect(await loadMoments(dir)).toEqual([]);
    expect(warnedText()).toContain("Not_A_Valid_Name!");
  });

  it("ignores unreadable image files and non-image files, keeping the moment", async () => {
    const dir = await tempContentDir();
    const momentDir = path.join(dir, "2026-01-02-mixed-bag");
    await mkdir(momentDir, { recursive: true });
    await writeFile(path.join(momentDir, "moment.yaml"), VALID_YAML);
    await writeFile(path.join(momentDir, "01-broken.png"), Buffer.from("definitely not a png"));
    await writeFile(path.join(momentDir, "02-real.png"), PIXEL_PNG);
    await writeFile(path.join(momentDir, "notes.txt"), "not an image at all");
    // Outside the supported whitelist (jpg/jpeg/png/webp) — must be silently ignored,
    // not counted as images, since uploads/rendering elsewhere will reject them too.
    await writeFile(path.join(momentDir, "clip.gif"), "GIF89a junk");
    await writeFile(path.join(momentDir, "still.avif"), "avif junk");

    const [moment] = await loadMoments(dir);
    expect(moment.kind).toBe("photo");
    expect(moment.images).toEqual([{ file: "02-real.png", width: 1, height: 1 }]);
    expect(moment.posterAspect).toBe("square");
    expect(warn).toHaveBeenCalledTimes(1); // the broken .png only; notes.txt, .gif, .avif silent
    expect(warnedText()).toContain("01-broken.png");
    expect(warnedText()).not.toContain("clip.gif");
    expect(warnedText()).not.toContain("still.avif");
  });

  it("never crashes: skips a folder whose listing fails mid-scan", async () => {
    // Simulates the race where a folder disappears between the parent directory
    // scan and the per-folder scan (or has unreadable permissions). A real fs
    // failure cannot be provoked deterministically on Windows without this seam.
    const dir = await tempContentDir();
    const gone = path.join(dir, "2026-01-01-vanished");
    const survivor = path.join(dir, "2026-01-02-survivor");
    for (const folder of [gone, survivor]) {
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, "moment.yaml"), VALID_YAML);
    }

    vi.resetModules();
    vi.doMock("node:fs/promises", async () => {
      const real = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      const original = real.readdir as unknown as (p: string, o?: unknown) => Promise<unknown>;
      return {
        ...real,
        readdir: async (...args: unknown[]) => {
          const target = String(args[0]);
          if (target === gone) {
            throw Object.assign(new Error(`ENOENT: no such file or directory, scandir '${target}'`), {
              code: "ENOENT",
            });
          }
          return original(target, args[1]);
        },
      };
    });
    try {
      const loader = await import("@/lib/content/loader");
      const moments = await loader.loadMoments(dir); // must resolve, not reject
      expect(moments.map((m) => m.id)).toEqual(["2026-01-02-survivor"]);
      expect(warnedText()).toContain("2026-01-01-vanished");
    } finally {
      vi.doUnmock("node:fs/promises");
      vi.resetModules();
    }
  });

  it("warns and returns nothing for a missing content dir", async () => {
    const moments = await loadMoments(path.join(tmpdir(), "loo-does-not-exist"));
    expect(moments).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("groupByYear", () => {
  it("groups the loaded moments by year, newest first", async () => {
    const moments = await loadMoments(FIXTURES);
    const groups = groupByYear(moments);

    expect(groups.map((g) => g.year)).toEqual([2026, 2025]);
    expect(groups[0].moments.map((m) => m.id)).toEqual([
      "2026-02-14-morning-run",
      "2026-02-14-late-thoughts",
    ]);
    expect(groups[1].moments.map((m) => m.id)).toEqual([
      "2025-11-03-half-grown",
      "2025-08-15-lakeside-circuit",
    ]);
  });
});

describe("findMoment", () => {
  it("returns the moment for a known id", async () => {
    const moment = await findMoment(FIXTURES, "2025-08-15-lakeside-circuit");
    expect(moment?.id).toBe("2025-08-15-lakeside-circuit");
    expect(moment?.title.en).toBe("Lakeside Circuit");
  });

  it("returns null for unknown or malformed ids", async () => {
    expect(await findMoment(FIXTURES, "2099-01-01-nope")).toBeNull();
    expect(await findMoment(FIXTURES, "../../etc")).toBeNull();
  });
});

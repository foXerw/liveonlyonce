import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearContentCache } from "@/lib/content/cache";
import { MOMENT_FOLDER_RE } from "@/lib/content/loader";
import { loadMoments } from "@/lib/content/loader";
import {
  ALLOWED_EXT,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  StoreValidationError,
  createMoment,
  deleteMoment,
  sanitizeFolderName,
  updateMoment,
  validateUpload,
  type MomentInput,
} from "@/lib/admin/store";

// Smallest valid 1x1 PNG (transparent) — same stand-in as the loader tests.
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function input(overrides: Partial<MomentInput> = {}): MomentInput {
  return {
    date: "2026-10-17",
    title: { zh: "新工作", en: "New Job" },
    description: { zh: "一段描述", en: "A description" },
    pinned: false,
    ...overrides,
  };
}

function upload(name: string, bytes: Buffer = PIXEL_PNG) {
  return { name, bytes };
}

const tempDirs: string[] = [];

async function tempContentDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "loo-store-"));
  tempDirs.push(dir);
  return dir;
}

beforeEach(() => {
  // Silences the loader's console.warn for skipped/temp folders; keep output pristine.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  clearContentCache();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("sanitizeFolderName", () => {
  it("produces a loader-legal folder name for a CJK title", () => {
    const folder = sanitizeFolderName("2026-10-17", "新工作");
    expect(folder.startsWith("2026-10-17-")).toBe(true);
    expect(folder).toMatch(MOMENT_FOLDER_RE);
  });

  it("slugifies ASCII titles", () => {
    expect(sanitizeFolderName("2026-10-17", "Morning Run!")).toBe("2026-10-17-morning-run");
    expect(sanitizeFolderName("2025-11-03", "  Half--Grown  v2 ")).toBe(
      "2025-11-03-half-grown-v2",
    );
    expect(sanitizeFolderName("2025-08-15", "Ünïcode Café")).toBe("2025-08-15-unicode-cafe");
  });

  it("falls back to a stable short hash when no ascii survives", () => {
    const a = sanitizeFolderName("2026-10-17", "新工作");
    const b = sanitizeFolderName("2026-10-17", "新工作");
    const c = sanitizeFolderName("2026-10-17", "另一个标题");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^2026-10-17-[0-9a-f]{8}$/);
    expect(a).toMatch(MOMENT_FOLDER_RE);
  });

  it("rejects malformed dates", () => {
    expect(() => sanitizeFolderName("2026-13-99", "x")).toThrow(StoreValidationError);
    expect(() => sanitizeFolderName("bad", "x")).toThrow(StoreValidationError);
  });
});

describe("validateUpload", () => {
  it("exposes the contract constants", () => {
    expect(ALLOWED_EXT).toEqual(["jpg", "jpeg", "png", "webp"]);
    expect(MAX_IMAGES).toBe(60);
    expect(MAX_IMAGE_BYTES).toBe(25 * 1024 * 1024);
  });

  it("accepts allowed extensions", () => {
    expect(() => validateUpload(upload("photo.jpg"))).not.toThrow();
    expect(() => validateUpload(upload("photo.JPEG"))).not.toThrow();
    expect(() => validateUpload(upload("pic.png"))).not.toThrow();
    expect(() => validateUpload(upload("pic.webp"))).not.toThrow();
  });

  it("rejects disallowed extensions, oversize files and pathy names", () => {
    expect(() => validateUpload(upload("evil.exe"))).toThrow(StoreValidationError);
    expect(() => validateUpload(upload("noext"))).toThrow(StoreValidationError);
    // last extension decides, matching the loader/asset-serving whitelist
    expect(() => validateUpload(upload("two.png.jpg"))).not.toThrow();
    expect(() =>
      validateUpload(upload("big.jpg", Buffer.alloc(MAX_IMAGE_BYTES + 1))),
    ).toThrow(StoreValidationError);
    expect(() => validateUpload(upload("../evil.jpg"))).toThrow(StoreValidationError);
    expect(() => validateUpload(upload("..\\evil.jpg"))).toThrow(StoreValidationError);
    expect(() => validateUpload(upload("a/b.jpg"))).toThrow(StoreValidationError);
    expect(() => validateUpload(upload("evil\0.jpg"))).toThrow(StoreValidationError);
    expect(() => validateUpload(upload(".jpg"))).toThrow(StoreValidationError);
    expect(() => validateUpload(upload("empty.png", Buffer.alloc(0)))).toThrow(
      StoreValidationError,
    );
    // exactly at the limit is fine
    expect(() => validateUpload(upload("ok.jpg", Buffer.alloc(MAX_IMAGE_BYTES)))).not.toThrow();
  });
});

describe("createMoment", () => {
  it("writes moment.yaml + images that loadMoments reads back", async () => {
    const dir = await tempContentDir();
    const created = await createMoment(dir, input({ pinned: true, location: { zh: "北京" } }), [
      upload("lake sunrise.png"),
      upload("dunes.jpg"),
    ]);

    expect(created.id).toMatch(MOMENT_FOLDER_RE);
    const yaml = await readFile(path.join(dir, created.id, "moment.yaml"), "utf8");
    expect(yaml).toContain("新工作");
    const files = (await readdir(path.join(dir, created.id))).sort();
    expect(files).toEqual(["01-lake-sunrise.png", "02-dunes.jpg", "moment.yaml"]);

    clearContentCache();
    const moments = await loadMoments(dir);
    expect(moments).toHaveLength(1);
    const read = moments[0];
    expect(read).toMatchObject({
      id: created.id,
      date: "2026-10-17",
      pinned: true,
      title: { zh: "新工作", en: "New Job" },
      description: { zh: "一段描述", en: "A description" },
      location: { zh: "北京" },
      kind: "album",
    });
    expect(read.images.map((i) => i.file)).toEqual(["01-lake-sunrise.png", "02-dunes.jpg"]);
    // 1x1 PNG parsed by sharp through the loader
    expect(read.poster).toEqual({ file: "01-lake-sunrise.png", width: 1, height: 1 });
    expect(read.posterAspect).toBe("square");
    expect(created).toEqual(read); // returned Moment equals the read-back
  });

  it("supports text-only moments (no files)", async () => {
    const dir = await tempContentDir();
    const created = await createMoment(dir, input(), []);
    expect(created.kind).toBe("text");
    expect((await loadMoments(dir))[0].images).toEqual([]);
  });

  it("appends -2, -3 suffixes on folder conflicts", async () => {
    const dir = await tempContentDir();
    const first = await createMoment(dir, input(), []);
    const second = await createMoment(dir, input(), []);
    const third = await createMoment(dir, input(), []);
    expect(second.id).toBe(`${first.id}-2`);
    expect(third.id).toBe(`${first.id}-3`);
    expect((await loadMoments(dir)).map((m) => m.id)).toEqual(
      [first.id, second.id, third.id].sort().reverse(),
    );
  });

  it("validates input before touching the disk", async () => {
    const dir = await tempContentDir();
    await expect(createMoment(dir, input({ date: "2026-02-30" }), [])).rejects.toThrow(
      StoreValidationError,
    );
    await expect(createMoment(dir, input({ title: { zh: "", en: "" } }), [])).rejects.toThrow(
      StoreValidationError,
    );
    await expect(
      createMoment(dir, input(), [upload("bad.exe")]),
    ).rejects.toThrow(StoreValidationError);
    expect(await readdir(dir)).toEqual([]);
  });

  it("caps images at MAX_IMAGES per moment", async () => {
    const dir = await tempContentDir();
    const many = Array.from({ length: MAX_IMAGES + 1 }, (_, i) => upload(`p${i}.png`));
    await expect(createMoment(dir, input(), many)).rejects.toThrow(StoreValidationError);
  });
});

describe("updateMoment", () => {
  it("rewrites yaml and merges files (add keeps existing)", async () => {
    const dir = await tempContentDir();
    const created = await createMoment(dir, input(), [upload("one.png")]);
    clearContentCache();

    await updateMoment(dir, created.id, {
      ...input(),
      title: { zh: "改过", en: "Edited" },
      pinned: true,
    }, { add: [upload("two.png")] });

    clearContentCache();
    const [read] = await loadMoments(dir);
    expect(read.title).toEqual({ zh: "改过", en: "Edited" });
    expect(read.pinned).toBe(true);
    expect(read.images.map((i) => i.file)).toEqual(["01-one.png", "02-two.png"]);
  });

  it("removes listed files and enforces MAX_IMAGES across existing + new", async () => {
    const dir = await tempContentDir();
    const created = await createMoment(dir, input(), [upload("one.png"), upload("two.png")]);

    await updateMoment(dir, created.id, input(), { remove: ["01-one.png"] });
    clearContentCache();
    expect((await loadMoments(dir))[0].images.map((i) => i.file)).toEqual(["02-two.png"]);

    await expect(
      updateMoment(dir, created.id, input(), {
        add: Array.from({ length: MAX_IMAGES }, (_, i) => upload(`x${i}.png`)),
      }),
    ).rejects.toThrow(StoreValidationError);
  });

  it("tolerates duplicate names in remove — unlinks once, update fully applies", async () => {
    const dir = await tempContentDir();
    const created = await createMoment(dir, input(), [upload("one.png"), upload("two.png")]);

    // Regression: a repeated name used to be unlinked twice — the second
    // unlink threw ENOENT (500) AFTER the first file was already gone and
    // before moment.yaml was rewritten: a half-applied update.
    await expect(
      updateMoment(
        dir,
        created.id,
        { ...input(), title: { zh: "改过", en: "Edited" } },
        { remove: ["01-one.png", "01-one.png"] },
      ),
    ).resolves.toBeUndefined();

    clearContentCache();
    const [read] = await loadMoments(dir);
    expect(read.title).toEqual({ zh: "改过", en: "Edited" });
    expect(read.images.map((i) => i.file)).toEqual(["02-two.png"]); // other file intact
    expect((await readdir(path.join(dir, created.id))).sort()).toEqual([
      "02-two.png",
      "moment.yaml",
    ]);
  });

  it("rejects replace+oversize BEFORE deleting existing images (no data loss)", async () => {
    const dir = await tempContentDir();
    const created = await createMoment(dir, input(), [upload("one.png"), upload("two.png")]);
    await expect(
      updateMoment(dir, created.id, input(), {
        replace: true,
        add: Array.from({ length: MAX_IMAGES + 1 }, (_, i) => upload(`x${i}.png`)),
      }),
    ).rejects.toThrow(StoreValidationError);
    clearContentCache();
    const [read] = await loadMoments(dir);
    expect(read.images.map((i) => i.file)).toEqual(["01-one.png", "02-two.png"]);
  });

  it("a failed add or mid-list removal leaves the folder completely untouched", async () => {
    const dir = await tempContentDir();
    const created = await createMoment(dir, input(), [upload("one.png"), upload("two.png")]);
    // last file invalid: none may be deleted nor written
    await expect(
      updateMoment(dir, created.id, input(), {
        remove: ["01-one.png"],
        add: [upload("ok.png"), upload("bad.exe")],
      }),
    ).rejects.toThrow(StoreValidationError);
    // second removal missing: the first must not have been unlinked
    await expect(
      updateMoment(dir, created.id, input(), { remove: ["01-one.png", "missing.png"] }),
    ).rejects.toThrow(StoreValidationError);
    expect((await readdir(path.join(dir, created.id))).sort()).toEqual([
      "01-one.png",
      "02-two.png",
      "moment.yaml",
    ]);
  });

  it("replace clears old images before adding new ones", async () => {
    const dir = await tempContentDir();
    const created = await createMoment(dir, input(), [upload("one.png")]);
    await updateMoment(dir, created.id, input(), {
      replace: true,
      add: [upload("fresh.png")],
    });
    clearContentCache();
    expect((await loadMoments(dir))[0].images.map((i) => i.file)).toEqual(["01-fresh.png"]);
  });

  it("rejects unknown ids, malformed ids and malformed removal names", async () => {
    const dir = await tempContentDir();
    await expect(updateMoment(dir, "no-such-folder", input())).rejects.toThrow();
    await expect(updateMoment(dir, "../escape", input(), {})).rejects.toThrow(
      StoreValidationError,
    );
    const created = await createMoment(dir, input(), []);
    await expect(
      updateMoment(dir, created.id, input(), { remove: ["../../etc/passwd"] }),
    ).rejects.toThrow(StoreValidationError);
    await expect(updateMoment(dir, created.id, input({ date: "oops" }), {})).rejects.toThrow(
      StoreValidationError,
    );
    // folder survives failed updates
    expect(await readdir(path.join(dir, created.id))).toEqual(["moment.yaml"]);
  });
});

describe("deleteMoment", () => {
  it("removes the whole folder", async () => {
    const dir = await tempContentDir();
    const created = await createMoment(dir, input(), [upload("one.png")]);
    await deleteMoment(dir, created.id);
    await expect(stat(path.join(dir, created.id))).rejects.toThrow();
    clearContentCache();
    expect(await loadMoments(dir)).toEqual([]);
  });

  it("rejects malformed ids without touching the fs, and 404s on missing folders", async () => {
    const dir = await tempContentDir();
    // plant a sibling that must NOT be deleted
    await writeFile(path.join(dir, "victim"), "x");
    for (const bad of ["../victim", "2026-10-17", "2026-10-17-UPPER", "", "..", "victim"]) {
      await expect(deleteMoment(dir, bad)).rejects.toThrow(StoreValidationError);
    }
    expect(await readdir(dir)).toEqual(["victim"]);
    await expect(deleteMoment(dir, "2026-10-17-not-there")).rejects.toThrow(
      StoreValidationError,
    );
  });
});

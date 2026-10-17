import { copyFile, mkdtemp, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { assetUrl } from "@/lib/media/url";
import { getTransformed, resolveAssetPath, type TransformRun } from "@/lib/media/serve";

// Vitest runs from the project root; jsdom import.meta.url is a server URL, not a file URL.
const FIXTURES = path.resolve(process.cwd(), "tests/fixtures/content");
const ALBUM = "2025-08-15-qinghai-grand-loop";
const SRC = path.join(FIXTURES, ALBUM, "01-lake-sunrise.png"); // real 1600x900 PNG

// Smallest valid 1x1 PNG (transparent) — stands in for a transform's output so
// the cache tests never need to run sharp.
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const tempDirs: string[] = [];

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("assetUrl", () => {
  it("builds the /api/asset URL with the width query", () => {
    expect(assetUrl(ALBUM, "01-lake-sunrise.png", 640)).toBe(
      `/api/asset/${ALBUM}/01-lake-sunrise.png?w=640`,
    );
  });

  it("percent-encodes the file name", () => {
    expect(assetUrl(ALBUM, "my photo.jpg", 1280)).toBe(
      `/api/asset/${ALBUM}/my%20photo.jpg?w=1280`,
    );
  });
});

describe("resolveAssetPath", () => {
  it("returns the absolute path for a valid moment id and file", () => {
    const resolved = resolveAssetPath(FIXTURES, ALBUM, "01-lake-sunrise.png");
    expect(resolved).toBe(path.resolve(FIXTURES, ALBUM, "01-lake-sunrise.png"));
    expect(resolved).not.toBeNull();
    expect(resolved!.startsWith(path.resolve(FIXTURES) + path.sep)).toBe(true);
  });

  it("rejects a decoded '../../' traversal (the '%2f..' case arrives pre-decoded)", () => {
    // The brief's canonical attack: URL `..%2f..%2fetc/passwd` reaches the
    // handler decoded as segments ['../../etc', 'passwd'].
    expect(resolveAssetPath(FIXTURES, "../../etc", "passwd")).toBeNull();
    expect(resolveAssetPath(FIXTURES, "..", "outside.png")).toBeNull();
    expect(resolveAssetPath(FIXTURES, ALBUM, "../../../Windows/win.ini.png")).toBeNull();
    // A nested-but-inside name is lexically fine (it just 404s at stat time).
    expect(resolveAssetPath(FIXTURES, ALBUM, `${ALBUM}/01-lake-sunrise.png`)).toBe(
      path.resolve(FIXTURES, ALBUM, ALBUM, "01-lake-sunrise.png"),
    );
  });

  it("rejects absolute path segments", () => {
    const outside = path.sep === "\\" ? "C:\\Windows\\evil.png" : "/etc/evil.png";
    expect(resolveAssetPath(FIXTURES, outside, "01-lake-sunrise.png")).toBeNull();
    expect(resolveAssetPath(FIXTURES, ALBUM, outside)).toBeNull();
  });

  it("rejects null bytes in either segment", () => {
    expect(resolveAssetPath(FIXTURES, `${ALBUM}\0`, "01-lake-sunrise.png")).toBeNull();
    expect(resolveAssetPath(FIXTURES, ALBUM, "01-lake-sunrise.png\0.exe")).toBeNull();
  });

  it("rejects anything outside the jpg/jpeg/png/webp whitelist", () => {
    expect(resolveAssetPath(FIXTURES, ALBUM, "payload.exe")).toBeNull();
    expect(resolveAssetPath(FIXTURES, ALBUM, "MOVIE.EXE")).toBeNull(); // case-insensitive
    expect(resolveAssetPath(FIXTURES, ALBUM, "clip.gif")).toBeNull();
    expect(resolveAssetPath(FIXTURES, ALBUM, "no-extension")).toBeNull();
    // The four whitelisted extensions pass (existence is not checked here).
    for (const name of ["a.jpg", "b.jpeg", "c.png", "d.webp"]) {
      expect(resolveAssetPath(FIXTURES, ALBUM, name)).toBe(
        path.resolve(FIXTURES, ALBUM, name),
      );
    }
  });

  it("rejects empty segments", () => {
    expect(resolveAssetPath(FIXTURES, "", "01-lake-sunrise.png")).toBeNull();
    expect(resolveAssetPath(FIXTURES, ALBUM, "")).toBeNull();
  });
});

describe("getTransformed", () => {
  it("runs the transform once, then serves the second call from the disk cache", async () => {
    const cacheDir = await tempDir("loo-cache-");
    const runs: string[] = [];
    const run: TransformRun = async (srcAbs, w) => {
      runs.push(`${srcAbs}:${w}`);
      return { body: PIXEL_PNG, contentType: "image/png" };
    };

    const first = await getTransformed(SRC, 640, { run, cacheDir });
    expect(runs).toEqual([`${SRC}:640`]);
    expect(first.contentType).toBe("image/png");

    const second = await getTransformed(SRC, 640, { run, cacheDir });
    expect(runs).toHaveLength(1); // no second transform — served from disk
    expect(second.body.equals(PIXEL_PNG)).toBe(true);
    expect(second.contentType).toBe("image/png");

    // A different width is a different cache entry, so the transform runs again.
    await getTransformed(SRC, 1280, { run, cacheDir });
    expect(runs).toHaveLength(2);
  });

  it("busts the cache when the source file's mtime changes", async () => {
    const cacheDir = await tempDir("loo-cache-");
    const srcDir = await tempDir("loo-src-");
    const copy = path.join(srcDir, "01-lake-sunrise.png");
    await copyFile(SRC, copy);

    const runs: string[] = [];
    const run: TransformRun = async (srcAbs, w) => {
      runs.push(`${srcAbs}:${w}`);
      return { body: PIXEL_PNG, contentType: "image/png" };
    };

    await getTransformed(copy, 640, { run, cacheDir });
    expect(runs).toHaveLength(1);
    await getTransformed(copy, 640, { run, cacheDir });
    expect(runs).toHaveLength(1);

    // Touch the source: same path, new mtime => key changes => transform reruns.
    const future = new Date(Date.now() + 10_000);
    await utimes(copy, future, future);
    await getTransformed(copy, 640, { run, cacheDir });
    expect(runs).toHaveLength(2);
  });

  it("performs a real sharp resize with the default transform", async () => {
    const cacheDir = await tempDir("loo-cache-");
    const { body, contentType } = await getTransformed(SRC, 640, { cacheDir });

    expect(contentType).toBe("image/png");
    const meta = await sharp(body).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(640);
    expect(meta.height).toBe(360); // 1600x900 scaled to width 640
  });

  it("does not enlarge a small source (withoutEnlargement)", async () => {
    const cacheDir = await tempDir("loo-cache-");
    const srcDir = await tempDir("loo-src-");
    const tiny = path.join(srcDir, "tiny.png");
    await sharp(PIXEL_PNG).resize(8, 8).toFile(tiny);

    const { body } = await getTransformed(tiny, 640, { cacheDir });
    const meta = await sharp(body).metadata();
    expect(meta.width).toBe(8);
  });

  it("rejects with ENOENT for a missing source file", async () => {
    const cacheDir = await tempDir("loo-cache-");
    const missing = path.join(FIXTURES, ALBUM, "09-does-not-exist.png");
    await expect(getTransformed(missing, 640, { cacheDir })).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

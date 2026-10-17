import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Whitelist is exactly jpg/jpeg/png/webp. Kept in sync with the module-private
// IMAGE_EXTENSIONS in lib/content/loader.ts (not exported there, so duplicated
// deliberately — uploads and asset serving must reject the same set).
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const CONTENT_TYPES = new Map<string, string>([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

export interface Transformed {
  body: Buffer;
  contentType: string;
}

/** Seam for the actual resize step; tests inject a counting stub here. */
export type TransformRun = (srcAbs: string, w: number) => Promise<Transformed>;

export interface TransformOptions {
  run?: TransformRun;
  cacheDir?: string;
}

/**
 * Lexically resolve `<contentDir>/<momentId>/<file>` and guard it:
 * both segments must be non-empty and free of null bytes, the resolved path
 * must stay inside the content dir, and the extension must be whitelisted.
 * Returns the absolute path, or null when the request is rejected.
 * (Traversal payloads like `..%2f..%2fetc` arrive already URL-decoded from the
 * route handler, so decoding is not handled here.)
 */
export function resolveAssetPath(contentDir: string, momentId: string, file: string): string | null {
  if (!momentId || !file) return null;
  if (momentId.includes("\0") || file.includes("\0")) return null;

  const absDir = path.resolve(contentDir);
  // path.resolve resets to an absolute second segment — the containment check
  // below then rejects absolute momentId/file values as well.
  const abs = path.resolve(absDir, momentId, file);
  if (!abs.startsWith(absDir + path.sep)) return null;

  const ext = path.extname(abs).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) return null;
  return abs;
}

/**
 * Resize `srcAbs` to width `w` and return the bytes, memoised on disk under
 * `.cache/media/<sha1(srcAbs + mtimeMs + w)>.<ext>`. A cache hit is read
 * straight from disk and never invokes the transform (`run`) again; touching
 * the source busts the entry through its mtime.
 */
export async function getTransformed(
  srcAbs: string,
  w: number,
  opts: TransformOptions = {},
): Promise<Transformed> {
  const run = opts.run ?? resizeWithSharp;
  const cacheDir = opts.cacheDir ?? path.resolve(".cache", "media");

  const source = await stat(srcAbs); // missing file: ENOENT propagates to the route
  const key = createHash("sha1")
    .update(`${srcAbs}${source.mtimeMs}${w}`)
    .digest("hex");
  const ext = path.extname(srcAbs).toLowerCase();
  // Content and cache dirs are runtime-mounted (self-host): the turbopackIgnore
  // comments below keep the build from tracing the whole project into the output.
  const cachePath = path.join(/* turbopackIgnore: true */ cacheDir, `${key}${ext}`);

  try {
    const body = await readFile(/* turbopackIgnore: true */ cachePath);
    return { body, contentType: CONTENT_TYPES.get(ext) ?? "application/octet-stream" };
  } catch {
    // cache miss — fall through and transform
  }

  const result = await run(srcAbs, w);
  try {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cachePath, result.body);
  } catch (error) {
    // A read-only or full cache disk must not break serving — hand back the bytes.
    console.warn(`[media] could not write cache entry "${cachePath}": ${reason(error)}`);
  }
  return result;
}

async function resizeWithSharp(srcAbs: string, w: number): Promise<Transformed> {
  // Object form: resize(width, height, options) — the two-positional-arg form
  // would take the options object as the height.
  const body = await sharp(srcAbs).resize({ width: w, withoutEnlargement: true }).toBuffer();
  const ext = path.extname(srcAbs).toLowerCase();
  return { body, contentType: CONTENT_TYPES.get(ext) ?? "image/jpeg" };
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { readContentCache, writeContentCache } from "@/lib/content/cache";
import { classifyAspect, inferKind, parseMomentYaml } from "@/lib/content/parse";
import type { Moment, MomentImage, YearGroup } from "@/lib/types";

/** `NNNN-MM-DD-<slug>` — the id of a moment is its folder name. */
const MOMENT_FOLDER_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$/;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

export async function loadMoments(contentDir: string): Promise<Moment[]> {
  const key = path.resolve(contentDir);
  const cached = readContentCache(key);
  if (cached) return cached;
  const moments = await scanContentDir(key);
  writeContentCache(key, moments);
  return moments;
}

export function groupByYear(moments: Moment[]): YearGroup[] {
  const byYear = new Map<number, Moment[]>();
  for (const moment of moments) {
    const year = Number(moment.date.slice(0, 4));
    const bucket = byYear.get(year);
    if (bucket) bucket.push(moment);
    else byYear.set(year, [moment]);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, yearMoments]) => ({ year, moments: yearMoments }));
}

export async function findMoment(contentDir: string, id: string): Promise<Moment | null> {
  const moments = await loadMoments(contentDir);
  return moments.find((moment) => moment.id === id) ?? null;
}

async function scanContentDir(dir: string): Promise<Moment[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    console.warn(`[content] cannot read content dir "${dir}"`);
    return [];
  }

  const moments: Moment[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folder = entry.name;
    if (!MOMENT_FOLDER_RE.test(folder)) {
      console.warn(`[content] skipped folder with invalid name "${folder}"`);
      continue;
    }
    const moment = await loadMomentFolder(path.join(dir, folder), folder);
    if (moment) moments.push(moment);
  }

  moments.sort(
    (a, b) => compareDesc(a.date, b.date) || compareDesc(a.id, b.id) || 0,
  );
  return moments;
}

async function loadMomentFolder(folderPath: string, folder: string): Promise<Moment | null> {
  let raw: string;
  try {
    raw = await readFile(path.join(folderPath, "moment.yaml"), "utf8");
  } catch {
    console.warn(`[content] skipped folder "${folder}" (no readable moment.yaml)`);
    return null;
  }

  let parsed;
  try {
    parsed = parseMomentYaml(raw, folder);
  } catch (error) {
    console.warn(`[content] skipped folder "${folder}": ${reason(error)}`);
    return null;
  }

  const images = await readImages(folderPath, folder);
  const poster = images[0] ?? null;
  return {
    ...parsed,
    images,
    kind: inferKind(images.length),
    poster,
    posterAspect: poster ? classifyAspect(poster.width, poster.height) : null,
  };
}

async function readImages(folderPath: string, folder: string): Promise<MomentImage[]> {
  const names = await readdir(folderPath);
  const images: MomentImage[] = [];
  for (const file of names.filter(isImageFile).sort()) {
    try {
      const meta = await sharp(path.join(folderPath, file)).metadata();
      if (!meta.width || !meta.height) throw new Error("no dimensions in metadata");
      images.push({ file, width: meta.width, height: meta.height });
    } catch (error) {
      console.warn(`[content] ignored unreadable image "${folder}/${file}": ${reason(error)}`);
    }
  }
  return images;
}

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function compareDesc(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

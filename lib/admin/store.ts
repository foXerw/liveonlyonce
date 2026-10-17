/**
 * The only write path into the content directory. Node-runtime only (fs,
 * node:crypto) — never import this from middleware.ts.
 *
 * Every folder/id taken from client input is validated against the loader's
 * MOMENT_FOLDER_RE before ANY fs call, and every resolved path is containment
 * checked against the content dir (same pattern as lib/media/serve.ts).
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify } from "yaml";
import { clearContentCache } from "@/lib/content/cache";
import { loadMoments, MOMENT_FOLDER_RE } from "@/lib/content/loader";
import { ALLOWED_EXT, MAX_IMAGE_BYTES, MAX_IMAGES } from "@/lib/admin/limits";
import type { LocalizedText, Moment } from "@/lib/types";

// Re-exported from lib/admin/limits (single source of truth, client-safe).
export { ALLOWED_EXT, MAX_IMAGE_BYTES, MAX_IMAGES };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class StoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreValidationError";
  }
}

export class StoreNotFoundError extends StoreValidationError {
  constructor(message: string) {
    super(message);
    this.name = "StoreNotFoundError";
  }
}

export interface UploadFile {
  name: string; // original client filename (may be hostile)
  bytes: Buffer;
}

export interface MomentInput {
  date: string;
  title: LocalizedText;
  description: LocalizedText;
  pinned: boolean;
  location?: LocalizedText;
}

/**
 * PATCH image contract (documented for the admin UI, deliberately minimal):
 * - add:     new files, merged with whatever already exists
 * - remove:  written filenames to delete (e.g. "01-photo.jpg")
 * - replace: delete every existing image before adding `add`
 */
export interface UpdateFiles {
  add?: UploadFile[];
  remove?: string[];
  replace?: boolean;
}

export function validateUpload(f: UploadFile): void {
  const { name, bytes } = f;
  if (typeof name !== "string" || name.length === 0) {
    throw new StoreValidationError("file name must be a non-empty string");
  }
  if (name.includes("\0")) throw new StoreValidationError(`file name contains a null byte: "${name}"`);
  if (name.includes("/") || name.includes("\\")) {
    throw new StoreValidationError(`file name contains a path separator: "${name}"`);
  }
  if (name.includes("..")) throw new StoreValidationError(`file name contains "..": "${name}"`);
  const ext = extensionOf(name);
  if (!ext || !ALLOWED_EXT.includes(ext)) {
    throw new StoreValidationError(`file extension must be one of ${ALLOWED_EXT.join(", ")}, got "${name}"`);
  }
  if (bytes.length === 0) throw new StoreValidationError(`file "${name}" is empty`);
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new StoreValidationError(`file "${name}" exceeds ${MAX_IMAGE_BYTES} bytes`);
  }
}

/**
 * `YYYY-MM-DD-<ascii-slug>` — output always satisfies MOMENT_FOLDER_RE.
 * Titles with no ascii left (pure CJK) fall back to a stable 8-char sha256
 * prefix of the full title. Conflict suffixes (-2, -3, ...) need the fs and
 * are applied by resolveFolderName()/createMoment().
 */
export function sanitizeFolderName(date: string, titleZh: string): string {
  if (typeof date !== "string" || !isCalendarDate(date)) {
    throw new StoreValidationError(`invalid date "${date}"`);
  }
  const slug = slugify(titleZh).slice(0, 48).replace(/-+$/, "");
  const suffix = slug || createHash("sha256").update(String(titleZh)).digest("hex").slice(0, 8);
  const folder = `${date}-${suffix}`;
  if (!MOMENT_FOLDER_RE.test(folder)) {
    // belt-and-braces: the slug/hash paths above already guarantee it
    throw new StoreValidationError(`cannot derive a legal folder name from "${date}" / "${titleZh}"`);
  }
  return folder;
}

/** Appends -2, -3, ... until the folder name is free under `contentDir`. */
async function resolveFolderName(contentDir: string, folder: string): Promise<string> {
  let candidate = folder;
  for (let n = 2; ; n++) {
    try {
      await stat(path.join(contentDir, candidate));
    } catch {
      return candidate;
    }
    candidate = `${folder}-${n}`;
    if (candidate.length > 120) throw new StoreValidationError(`too many "${folder}" conflicts`);
  }
}

/**
 * Creates `<contentDir>/<id>/` with `moment.yaml` plus sanitized image
 * files (`01-slug.ext`, `02-slug.ext`, ...) and returns the Moment read
 * back through the normal loader — proving the yaml round-trips.
 */
export async function createMoment(
  contentDir: string,
  input: MomentInput,
  files: UploadFile[],
): Promise<Moment> {
  validateMomentInput(input);
  for (const f of files) validateUpload(f);
  if (files.length > MAX_IMAGES) {
    throw new StoreValidationError(`too many files: ${files.length} > ${MAX_IMAGES}`);
  }

  const root = path.resolve(contentDir);
  await mkdir(root, { recursive: true });

  const base = sanitizeFolderName(input.date, input.title.zh ?? input.title.en ?? "");
  let id = "";
  let folderPath = "";
  // mkdir without recursive is exclusive — closes the create-vs-list race.
  for (let attempt = 0; attempt < 10; attempt++) {
    id = await resolveFolderName(root, base);
    folderPath = joinUnderRoot(root, id);
    try {
      await mkdir(folderPath);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (attempt === 9) throw new StoreValidationError(`could not allocate a folder for "${base}"`);
    }
  }

  for (let i = 0; i < files.length; i++) {
    await writeFile(path.join(folderPath, writtenName(i + 1, files[i].name)), files[i].bytes);
  }
  await writeFile(path.join(folderPath, "moment.yaml"), buildMomentYaml(input));

  clearContentCache();
  const created = (await loadMoments(root)).find((m) => m.id === id);
  if (!created) {
    throw new StoreValidationError(`created moment "${id}" failed validation on read-back`);
  }
  return created;
}

/**
 * Rewrites moment.yaml in place and merges images per the UpdateFiles
 * contract. Note: changing `date` updates the yaml only — the folder id is
 * stable and keeps its original date prefix (no rename in the minimal
 * contract).
 */
export async function updateMoment(
  contentDir: string,
  id: string,
  input: MomentInput,
  files: UpdateFiles = {},
): Promise<void> {
  validateMomentInput(input);
  const root = path.resolve(contentDir);
  const folderPath = joinUnderRoot(root, requireValidId(id));
  await requireFolder(folderPath, id);

  // --- validation phase: NOTHING below this point may mutate until every
  // input has passed, so a rejected PATCH can never destroy existing images.
  const add = files.add ?? [];
  for (const f of add) validateUpload(f);

  const all = await readdir(folderPath);
  const existing = all.filter((name) => isImageName(name) && !name.includes("..") && name !== "moment.yaml");

  const toRemove: string[] = [];
  for (const raw of files.remove ?? []) {
    toRemove.push(requireRemovableImage(raw, existing));
  }

  // Projected final image set — MAX_IMAGES arithmetic happens BEFORE any unlink.
  const kept = files.replace ? [] : existing.filter((name) => !toRemove.includes(name));
  if (kept.length + add.length > MAX_IMAGES) {
    throw new StoreValidationError(
      `too many images: ${kept.length} kept + ${add.length} new > ${MAX_IMAGES}`,
    );
  }

  // --- destructive phase: all inputs validated above; safe to mutate now.
  const doomed = files.replace ? existing : toRemove;
  for (const name of doomed) await unlink(path.join(folderPath, name));

  const taken = new Set<string>(kept);
  let index = kept.reduce((max, name) => Math.max(max, numericPrefix(name)), 0);
  for (const f of add) {
    let name: string;
    do {
      index += 1;
      name = writtenName(index, f.name);
    } while (taken.has(name));
    taken.add(name);
    await writeFile(path.join(folderPath, name), f.bytes);
  }

  await writeFile(path.join(folderPath, "moment.yaml"), buildMomentYaml(input));
  clearContentCache();
}

/** Removes the whole moment folder (recursive delete, containment-checked). */
export async function deleteMoment(contentDir: string, id: string): Promise<void> {
  const root = path.resolve(contentDir);
  const folderPath = joinUnderRoot(root, requireValidId(id));
  await requireFolder(folderPath, id);
  await rm(folderPath, { recursive: true });
  clearContentCache();
}

// --- helpers ---------------------------------------------------------------

function requireValidId(id: string): string {
  // Validate BEFORE building any path — raw input never reaches the fs layer.
  if (typeof id !== "string" || !MOMENT_FOLDER_RE.test(id)) {
    throw new StoreValidationError(`invalid moment id "${id}"`);
  }
  return id;
}

/** resolve + containment, mirroring lib/media/serve.ts resolveAssetPath. */
function joinUnderRoot(root: string, id: string): string {
  const abs = path.resolve(root, id);
  if (!abs.startsWith(root + path.sep)) {
    throw new StoreValidationError(`path escapes the content dir: "${id}"`);
  }
  return abs;
}

async function requireFolder(folderPath: string, id: string): Promise<void> {
  try {
    const info = await stat(folderPath);
    if (!info.isDirectory()) throw new StoreNotFoundError(`moment "${id}" is not a folder`);
  } catch (error) {
    if (error instanceof StoreNotFoundError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new StoreNotFoundError(`moment "${id}" not found`);
    }
    throw error;
  }
}

function requireRemovableImage(raw: unknown, images: string[]): string {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new StoreValidationError("remove: file name must be a non-empty string");
  }
  if (raw.includes("/") || raw.includes("\\") || raw.includes("..") || raw.includes("\0")) {
    throw new StoreValidationError(`remove: illegal file name "${raw}"`);
  }
  if (!isImageName(raw)) {
    throw new StoreValidationError(`remove: "${raw}" is not an allowed image file`);
  }
  if (!images.includes(raw)) {
    throw new StoreNotFoundError(`remove: "${raw}" not found in moment`);
  }
  return raw;
}

function validateMomentInput(input: MomentInput): void {
  if (typeof input?.date !== "string" || !isCalendarDate(input.date)) {
    throw new StoreValidationError(`invalid date "${String(input?.date)}"`);
  }
  const hasTitle = hasText(input?.title);
  if (!hasTitle) throw new StoreValidationError("title must have a non-empty zh or en value");
}

function hasText(t: LocalizedText | undefined): boolean {
  return Boolean(t && (nonEmpty(t.zh) || nonEmpty(t.en)));
}

function nonEmpty(s: string | undefined): boolean {
  return typeof s === "string" && s.length > 0;
}

function isCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
  );
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return ""; // no extension, or dotfile like ".jpg"
  return name.slice(dot + 1).toLowerCase();
}

function isImageName(name: string): boolean {
  return ALLOWED_EXT.includes(extensionOf(name));
}

/** "Ünïcode Café!" -> "unicode-cafe"; CJK-only collapses to "". */
function slugify(value: string): string {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks (U+0300..U+036F)
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Deterministic, collision-free within a folder: 01-photo.jpg, 02-... */
function writtenName(index: number, originalName: string): string {
  const ext = extensionOf(originalName);
  const stem = originalName.slice(0, originalName.lastIndexOf("."));
  const slug = slugify(stem).slice(0, 40).replace(/-+$/, "") || "image";
  return `${String(index).padStart(2, "0")}-${slug}.${ext}`;
}

function numericPrefix(name: string): number {
  const match = /^(\d+)-/.exec(name);
  return match ? Number(match[1]) : 0;
}

/**
 * yaml shape consumed verbatim by parseMomentYaml: date, title{zh,en},
 * description{zh,en}, location?, pinned?. Empty locales are omitted; the
 * `yaml` package keeps plain YYYY-MM-DD scalars as strings (round-trips).
 */
function buildMomentYaml(input: MomentInput): string {
  const doc: Record<string, unknown> = { date: input.date, title: compact(input.title) };
  const description = compact(input.description);
  if (Object.keys(description).length > 0) doc.description = description;
  const location = compact(input.location);
  if (Object.keys(location).length > 0) doc.location = location;
  if (input.pinned === true) doc.pinned = true;
  return stringify(doc);
}

function compact(t: LocalizedText | undefined): LocalizedText {
  const out: LocalizedText = {};
  if (nonEmpty(t?.zh)) out.zh = t!.zh;
  if (nonEmpty(t?.en)) out.en = t!.en;
  return out;
}

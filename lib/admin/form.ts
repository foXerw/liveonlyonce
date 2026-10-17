/**
 * Shared multipart-form parsing for the admin moments routes (POST create and
 * PATCH update). Lives in lib/admin so both route files can import it — route
 * files must not import each other. Node-runtime only (Buffer, File bytes).
 *
 * Field contract (documented for the admin UI / curl):
 *   date              "YYYY-MM-DD" (calendar-validated)
 *   title[zh] title[en]              — at least one required
 *   description[zh] description[en]  — optional
 *   location[zh] location[en]        — optional
 *   pinned            "true"|"1"|"on" (anything else parses as false)
 *   files[]           image files (also accepted under the name "files")
 *   removeFiles       written file names to delete (PATCH only, repeatable)
 *   replaceFiles      "true" to drop every existing image first (PATCH only)
 */
import {
  StoreValidationError,
  validateUpload,
  type MomentInput,
  type UploadFile,
} from "@/lib/admin/store";
import type { LocalizedText } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ParsedForm {
  input: MomentInput | null;
  files: UploadFile[];
  /** field-name -> error message; non-empty means respond 400. */
  fields: Record<string, string>;
}

function isCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
  );
}

function readLocalized(form: FormData, prefix: string): LocalizedText {
  const out: LocalizedText = {};
  for (const locale of ["zh", "en"] as const) {
    const value = form.get(`${prefix}[${locale}]`);
    if (typeof value === "string" && value.trim().length > 0) out[locale] = value.trim();
  }
  return out;
}

function readPinned(form: FormData, fields: Record<string, string>): boolean {
  const raw = form.get("pinned");
  if (raw === null || typeof raw !== "string") return false;
  const value = raw.trim().toLowerCase();
  if (["true", "1", "on", "yes"].includes(value)) return true;
  if (["false", "0", "off", "no", ""].includes(value)) return false;
  fields["pinned"] = `pinned must be a boolean, got "${raw}"`;
  return false;
}

async function readFiles(form: FormData, fields: Record<string, string>): Promise<UploadFile[]> {
  const entries = [...form.getAll("files[]"), ...form.getAll("files")];
  const files: UploadFile[] = [];
  for (const entry of entries) {
    if (!(entry instanceof File)) {
      fields["files"] = "files[] must be file uploads";
      continue;
    }
    const file: UploadFile = { name: entry.name, bytes: Buffer.from(await entry.arrayBuffer()) };
    try {
      validateUpload(file);
    } catch (error) {
      fields["files"] = error instanceof Error ? error.message : String(error);
      continue;
    }
    files.push(file);
  }
  return files;
}

export async function parseMomentForm(
  form: FormData,
  options: { partialFiles: boolean },
): Promise<ParsedForm> {
  const fields: Record<string, string> = {};

  const dateRaw = form.get("date");
  if (typeof dateRaw !== "string" || dateRaw.trim().length === 0) {
    fields["date"] = "date is required";
  } else if (!isCalendarDate(dateRaw.trim())) {
    fields["date"] = `date must be a calendar date "YYYY-MM-DD", got "${dateRaw}"`;
  }

  const title = readLocalized(form, "title");
  if (!title.zh && !title.en) fields["title"] = "title requires zh or en";

  const input: MomentInput | null =
    Object.keys(fields).length === 0 && typeof dateRaw === "string"
      ? {
          date: dateRaw.trim(),
          title,
          description: readLocalized(form, "description"),
          pinned: readPinned(form, fields),
          location: readLocalized(form, "location"),
        }
      : null;

  const files = await readFiles(form, fields);
  // options.partialFiles is reserved for future partial semantics; today both
  // routes validate the whole input. Fail loudly instead of silently ignoring it.
  if (options.partialFiles) throw new StoreValidationError("partialFiles is not supported");

  return { input, files, fields };
}

/** Extracts PATCH-only image merge directives from the form. */
export function parseFileDirectives(form: FormData, fields: Record<string, string>): {
  remove?: string[];
  replace?: boolean;
} {
  const out: { remove?: string[]; replace?: boolean } = {};
  const removes = form.getAll("removeFiles");
  if (removes.length > 0) {
    const list: string[] = [];
    for (const entry of removes) {
      if (typeof entry !== "string" || entry.trim().length === 0) {
        fields["removeFiles"] = "removeFiles must be non-empty file names";
        continue;
      }
      list.push(entry.trim());
    }
    out.remove = list;
  }
  const replace = form.get("replaceFiles");
  if (typeof replace === "string") {
    const value = replace.trim().toLowerCase();
    if (["true", "1", "on", "yes"].includes(value)) out.replace = true;
    else if (!["false", "0", "off", "no", ""].includes(value)) {
      fields["replaceFiles"] = `replaceFiles must be a boolean, got "${replace}"`;
    }
  }
  return out;
}

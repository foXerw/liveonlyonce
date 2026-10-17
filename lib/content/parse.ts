import { parse as parseYaml } from "yaml";
import type { AspectClass, LocalizedText, Locale, Moment, MomentKind } from "@/lib/types";

export function inferKind(imageCount: number): MomentKind {
  if (imageCount <= 0) return "text";
  if (imageCount === 1) return "photo";
  return "album";
}

export function classifyAspect(w: number, h: number): AspectClass {
  const ratio = w / h;
  if (ratio >= 1.4) return "wide";
  if (ratio >= 0.8) return "square";
  return "tall";
}

export function resolveText(t: LocalizedText, locale: Locale): string {
  const other: Locale = locale === "zh" ? "en" : "zh";
  return t[locale] ?? t[other] ?? "";
}

export function parseMomentYaml(
  raw: string,
  folderName: string,
): Omit<Moment, "images" | "kind" | "poster" | "posterAspect"> {
  let doc: unknown;
  try {
    doc = parseYaml(raw);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`moment.yaml is not valid yaml (folder "${folderName}"): ${reason}`);
  }
  if (!isRecord(doc)) {
    throw new Error(`moment.yaml must be a mapping (folder "${folderName}")`);
  }

  const date = typeof doc.date === "string" ? doc.date : "";
  if (!isCalendarDate(date)) {
    throw new Error(`invalid date "${date}" (folder "${folderName}")`);
  }

  const title = readLocalizedText(doc.title);
  if (!title.zh && !title.en) {
    throw new Error(`missing title (folder "${folderName}")`);
  }

  const parsed: Omit<Moment, "images" | "kind" | "poster" | "posterAspect"> = {
    id: folderName,
    date,
    pinned: doc.pinned === true,
    title,
    description: readLocalizedText(doc.description),
  };
  const location = readLocalizedText(doc.location);
  if (location.zh !== undefined || location.en !== undefined) {
    parsed.location = location;
  }
  return parsed;
}

function readLocalizedText(value: unknown): LocalizedText {
  if (!isRecord(value)) return {};
  const out: LocalizedText = {};
  for (const locale of ["zh", "en"] as const) {
    const text = value[locale];
    if (typeof text === "string" && text.length > 0) out[locale] = text;
  }
  return out;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

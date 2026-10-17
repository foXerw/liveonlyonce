import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { LocalizedText } from "@/lib/types";

export interface SiteConfig {
  siteName: string;
  heroLine: LocalizedText;
  heroNote: LocalizedText;
  contactEmail: string;
  about: LocalizedText;
  footer: LocalizedText;
}

const DEFAULT_PATH = "site.config.yaml";

// Built-in placeholder copy, mirrored by the committed site.config.yaml.
// Used when the file is missing, unreadable or not a usable mapping.
const PLACEHOLDER: SiteConfig = {
  siteName: "LiveOnlyOnce",
  heroLine: { zh: "此刻不会重来第二次", en: "This moment will not come again" },
  heroNote: { zh: "一些只发生过一次的时刻", en: "Some moments that happened only once" },
  contactEmail: "hello@liveonlyonce.me",
  about: {
    zh: "这是一个存放生活瞬间的小站，按日期排列，慢慢回看。",
    en: "A small site for moments that only happen once, kept in date order.",
  },
  footer: { zh: "只活一次，记下来。", en: "Live once. Write it down." },
};

export function loadSiteConfig(path: string = DEFAULT_PATH): SiteConfig {
  let text: string;
  try {
    // Intentionally a runtime read of the repo-root config file on the host
    // (self-hosted deployment via `next start`); opting out of bundler
    // file-tracing keeps Turbopack from pulling the whole project into output.
    text = readFileSync(/* turbopackIgnore: true */ path, "utf-8");
  } catch {
    warnPlaceholderFallback(path, "could not be read (missing file?)");
    return fromFields(null);
  }
  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch {
    warnPlaceholderFallback(path, "is not valid YAML");
    return fromFields(null);
  }
  if (!isRecord(doc)) {
    warnPlaceholderFallback(path, "is not a mapping");
    return fromFields(null);
  }
  return fromFields(doc);
}

// Total fallback (missing/unparseable/non-mapping file) is silent by design
// in that the site keeps working on placeholders — but it must not be silent
// in the logs, or a typo'd site.config.yaml reads as "my hero copy is gone".
// Warn once per process; per-field placeholder merges are normal behavior
// and stay quiet.
let placeholderWarned = false;

function warnPlaceholderFallback(path: string, reason: string): void {
  if (placeholderWarned) return;
  placeholderWarned = true;
  console.warn(
    `[config] site config "${path}" ${reason}; using built-in placeholder copy ` +
      `(logged once — fix the file and restart to take effect)`,
  );
}

// Module-level singleton (server only — reads the filesystem at import).
export const siteConfig: SiteConfig = loadSiteConfig();

function fromFields(doc: Record<string, unknown> | null): SiteConfig {
  const fields = doc ?? {};
  return {
    siteName: readString(fields.siteName) ?? PLACEHOLDER.siteName,
    heroLine: readLocalized(fields.heroLine, PLACEHOLDER.heroLine),
    heroNote: readLocalized(fields.heroNote, PLACEHOLDER.heroNote),
    contactEmail: readString(fields.contactEmail) ?? PLACEHOLDER.contactEmail,
    about: readLocalized(fields.about, PLACEHOLDER.about),
    footer: readLocalized(fields.footer, PLACEHOLDER.footer),
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readLocalized(value: unknown, fallback: LocalizedText): LocalizedText {
  if (!isRecord(value)) return { ...fallback };
  const out: LocalizedText = {};
  for (const locale of ["zh", "en"] as const) {
    const text = readString(value[locale]);
    if (text !== undefined) out[locale] = text;
    else if (fallback[locale] !== undefined) out[locale] = fallback[locale];
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

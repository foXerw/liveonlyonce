import type { Metadata } from "next";
import { siteConfig } from "@/lib/config/site";
import { assetUrl } from "@/lib/media/url";

/**
 * The width tier used for social-preview images: the middle tier of the
 * served {640, 1280, 1920} set (see lib/media/url.ts) — a comfortable
 * og:image width, and the one share crawlers downscale best.
 */
const OG_IMAGE_WIDTH = 1280;

export interface PageMetadataInput {
  title: string;
  description: string;
  /** Poster file name; only meaningful together with `momentId`. */
  imageFile?: string;
  momentId?: string;
}

/**
 * Build page-level metadata for a moment (or any chrome page): document
 * title suffixed with the site name, openGraph + twitter mirrors, and an
 * og:image pointing at the moment's first image when one is known.
 *
 * The og:image URL is intentionally relative — Next resolves it against
 * `metadataBase` (see app/layout.tsx, driven by SITE_URL). Width/height are
 * omitted on purpose: assets are served with `withoutEnlargement`, so the
 * delivered image can be narrower than the requested tier and the exact
 * size is not cheaply knowable from these inputs alone.
 */
export function buildPageMetadata({
  title,
  description,
  imageFile,
  momentId,
}: PageMetadataInput): Metadata {
  const qualifiedTitle = qualifyTitle(title);
  const shareImage =
    imageFile && momentId
      ? [{ url: assetUrl(momentId, imageFile, OG_IMAGE_WIDTH) }]
      : undefined;

  return {
    title: qualifiedTitle,
    description,
    openGraph: {
      title: qualifiedTitle,
      description,
      ...(shareImage ? { images: shareImage } : {}),
    },
    twitter: {
      card: "summary_large_image",
      ...(shareImage ? { images: shareImage } : {}),
    },
  };
}

/** `<page> · <siteName>`; a blank page title degrades to just the site name. */
function qualifyTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? `${trimmed} · ${siteConfig.siteName}` : siteConfig.siteName;
}

/**
 * Absolute origin for resolving relative metadata URLs. Reads SITE_URL at
 * call time (not module load) so tests and deployment can set it freely;
 * unset or malformed yields undefined and Next falls back to localhost
 * (with its dev warning) — acceptable for a self-hosted app.
 */
export function resolveMetadataBase(): URL | undefined {
  const raw = process.env.SITE_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw);
  } catch {
    console.warn(`[seo] SITE_URL "${raw}" is not an absolute URL; ignoring it`);
    return undefined;
  }
}

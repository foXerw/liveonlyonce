/** URL of an on-demand resized asset. `w` must be one of the served width tiers. */
export function assetUrl(momentId: string, file: string, w: 640 | 1280 | 1920): string {
  return `/api/asset/${momentId}/${encodeURIComponent(file)}?w=${w}`;
}

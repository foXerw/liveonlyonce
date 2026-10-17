/**
 * Upload limits shared by the server store and the admin browser UI.
 * Deliberately dependency-free (no node imports) so client components may
 * import it; lib/admin/store.ts re-exports these for server-side callers and
 * remains the authority that actually enforces them.
 */
export const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp"];
export const MAX_IMAGES = 60;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

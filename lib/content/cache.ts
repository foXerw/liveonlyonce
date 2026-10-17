import type { Moment } from "@/lib/types";

const TTL_MS = 15_000;

interface CacheEntry {
  moments: Moment[];
  expiresAt: number;
}

// Production bundling (turbopack) duplicates module-level state per server
// chunk group — pages and API routes each get their own copy of this module,
// so clearContentCache() from an admin write route would never reach the
// page-render copy (observed in the Task 8 smoke: / served a deleted moment
// until the 15s TTL expired). Hosting the Map on globalThis keeps exactly one
// cache per process, shared by every bundle copy. Self-host runs a single
// Node server, so cross-process coherence beyond the TTL is out of scope.
const holder = globalThis as typeof globalThis & {
  __looContentCache?: Map<string, CacheEntry>;
};
const cache = (holder.__looContentCache ??= new Map<string, CacheEntry>());

export function readContentCache(key: string): Moment[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.moments;
}

export function writeContentCache(key: string, moments: Moment[]): void {
  cache.set(key, { moments, expiresAt: Date.now() + TTL_MS });
}

/** Drops every cached listing so the next loadMoments() rescans the disk. */
export function clearContentCache(): void {
  cache.clear();
}

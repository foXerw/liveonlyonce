import type { Moment } from "@/lib/types";

const TTL_MS = 15_000;

interface CacheEntry {
  moments: Moment[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

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

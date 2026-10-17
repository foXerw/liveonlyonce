import path from "node:path";

/**
 * Root of the content directory. Read env at call time (not import time) so
 * tests and deployment can override CONTENT_DIR without reloading modules.
 */
export function contentDir(): string {
  return process.env.CONTENT_DIR || path.resolve("content");
}

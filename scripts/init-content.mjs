// Bootstraps a fresh content directory from the committed example content.
//
// Behaviour (mirrored by test/scripts/init-content.test.ts):
//   - Target = $CONTENT_DIR, else ./content relative to the current directory
//     — the same resolution as lib/content/dir.ts, so what this script writes
//     is exactly what the app reads.
//   - Missing or empty target  -> every file under content-example/ is copied
//     in, preserving the folder layout.
//   - Non-empty target         -> left completely untouched (your real
//     moments are never mixed with or shadowed by example data).
//   - Existing files are never overwritten, even inside an empty-looking
//     directory populated between the check and the copy (belt and braces).
//
// Usage: npm run init:content   (optionally with CONTENT_DIR set)
import { access, copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(rootDir, "content-example");
const targetDir = process.env.CONTENT_DIR
  ? path.resolve(process.env.CONTENT_DIR)
  : path.resolve("content");

/** Recursively collect file paths (relative to `dir`) below `dir`. */
async function listFiles(dir, prefix = "") {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(path.join(dir, entry.name), rel)));
    else if (entry.isFile()) out.push(rel);
    // Symlinks and other exotic entries are intentionally not copied.
  }
  return out;
}

async function isEmptyOrMissingDir(dir) {
  let info;
  try {
    info = await stat(dir);
  } catch (error) {
    if (error.code === "ENOENT") return true; // does not exist yet
    throw error;
  }
  if (!info.isDirectory()) {
    throw new Error(`content target "${dir}" exists but is not a directory`);
  }
  return (await readdir(dir)).length === 0;
}

async function main() {
  let sourceEntries;
  try {
    sourceEntries = await listFiles(sourceDir);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`example content missing at "${sourceDir}" — run this from a full checkout`);
    }
    throw error;
  }
  if (sourceEntries.length === 0) {
    throw new Error(`example content directory "${sourceDir}" is empty`);
  }

  if (!(await isEmptyOrMissingDir(targetDir))) {
    console.log(`[init-content] ${targetDir} already has content — left untouched.`);
    return;
  }

  let copied = 0;
  let skipped = 0;
  for (const rel of sourceEntries) {
    const dest = path.join(targetDir, rel);
    try {
      await access(dest);
      skipped += 1; // never overwrite an existing file
      continue;
    } catch {
      // missing — fall through and copy
    }
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(path.join(sourceDir, rel), dest);
    copied += 1;
  }
  console.log(
    `[init-content] bootstrapped ${targetDir} from content-example/ (${copied} file(s) copied, ${skipped} pre-existing kept).`,
  );
}

main().catch((error) => {
  console.error(`[init-content] ${error.message}`);
  process.exitCode = 1;
});

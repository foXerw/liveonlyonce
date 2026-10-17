import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(rootDir, "scripts", "init-content.mjs");
const sourceDir = path.join(rootDir, "content-example");

/** Run the bootstrap CLI with CONTENT_DIR pointed at `dir`; returns stdout. */
function run(dir: string): string {
  return execFileSync(process.execPath, [scriptPath], {
    cwd: rootDir,
    env: { ...process.env, CONTENT_DIR: dir },
    encoding: "utf8",
  });
}

async function exists(file: string): Promise<boolean> {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}

describe("scripts/init-content.mjs", () => {
  let tmpRoot: string;
  const expectedFiles: string[] = [];

  beforeAll(async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "loo-init-content-"));
    // Snapshot what content-example actually contains so the assertions
    // track the fixture generator instead of a hardcoded list.
    for (const entry of await readdir(sourceDir)) {
      for (const file of await readdir(path.join(sourceDir, entry))) {
        expectedFiles.push(`${entry}/${file}`);
      }
    }
    expect(expectedFiles.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("copies content-example into a missing CONTENT_DIR", async () => {
    const dir = path.join(tmpRoot, "fresh"); // does not exist yet
    const out = run(dir);
    expect(out).toContain("copied");
    for (const rel of expectedFiles) {
      expect(await exists(path.join(dir, rel)), rel).toBe(true);
    }
  });

  it("is idempotent: never overwrites files on a second run", async () => {
    const dir = path.join(tmpRoot, "edited");
    run(dir);
    const touched = path.join(dir, expectedFiles[0].split("/")[0], "moment.yaml");
    await writeFile(touched, "# my own moment, do not clobber\n", "utf8");

    const out = run(dir); // second run: directory is non-empty -> untouched
    expect(out).toContain("untouched");
    expect(await readFile(touched, "utf8")).toBe("# my own moment, do not clobber\n");
    for (const rel of expectedFiles) {
      expect(await exists(path.join(dir, rel)), rel).toBe(true);
    }
  });

  it("leaves a non-empty CONTENT_DIR completely alone", async () => {
    const dir = path.join(tmpRoot, "real-content");
    await mkdir(path.join(dir, "2030-01-01-mine"), { recursive: true });
    const marker = path.join(dir, "2030-01-01-mine", "moment.yaml");
    await writeFile(marker, "date: 2030-01-01\n", "utf8");

    const out = run(dir);
    expect(out).toContain("untouched");
    expect(await readdir(dir)).toEqual(["2030-01-01-mine"]);
  });

  it("fills an existing but empty CONTENT_DIR", async () => {
    const dir = path.join(tmpRoot, "empty-dir");
    await mkdir(dir, { recursive: true });
    run(dir);
    for (const rel of expectedFiles) {
      expect(await exists(path.join(dir, rel)), rel).toBe(true);
    }
  });
});

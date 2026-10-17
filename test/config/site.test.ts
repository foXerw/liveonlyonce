import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSiteConfig, siteConfig } from "@/lib/config/site";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "loo-site-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

// The total-fallback path now logs one console.warn; keep vitest output
// pristine for the behavior tests and let the warn describe below inspect
// the same spy's call history.
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadSiteConfig", () => {
  it("reads the real site.config.yaml at the project root", () => {
    const config = loadSiteConfig();
    expect(config.siteName).toBe("LiveOnlyOnce");
    expect(config.contactEmail).toBe("hello@liveonlyonce.me");
    for (const field of ["heroLine", "heroNote", "about", "footer"] as const) {
      expect(config[field].zh).toBeTruthy();
      expect(config[field].en).toBeTruthy();
    }
  });

  it("exposes the same values through the module-level singleton", () => {
    expect(siteConfig).toEqual(loadSiteConfig());
  });

  it("falls back to built-in placeholders when the file is missing", () => {
    const fallback = loadSiteConfig(path.join(dir, "does-not-exist.yaml"));
    expect(fallback.siteName).toBeTruthy();
    expect(fallback.heroLine.zh).toBeTruthy();
    expect(fallback.heroLine.en).toBeTruthy();
    expect(fallback.contactEmail).toContain("@");
    // deterministic: two different missing paths yield equal configs
    expect(loadSiteConfig(path.join(dir, "also-missing.yaml"))).toEqual(fallback);
  });

  it("falls back to placeholders when the yaml is broken or not a mapping", () => {
    const fallback = loadSiteConfig(path.join(dir, "does-not-exist.yaml"));

    const broken = path.join(dir, "broken.yaml");
    writeFileSync(broken, "siteName: {unterminated", "utf-8");
    expect(loadSiteConfig(broken)).toEqual(fallback);

    const list = path.join(dir, "list.yaml");
    writeFileSync(list, "- just\n- a\n- list", "utf-8");
    expect(loadSiteConfig(list)).toEqual(fallback);
  });

  it("merges partial overrides locale-by-locale over the placeholders", () => {
    const file = path.join(dir, "partial.yaml");
    writeFileSync(
      file,
      `siteName: My Site
heroLine:
  zh: 只有中文的一行
footer: "not a mapping"
`,
      "utf-8",
    );
    const config = loadSiteConfig(file);
    expect(config.siteName).toBe("My Site");
    expect(config.heroLine.zh).toBe("只有中文的一行");
    expect(config.heroLine.en).toBeTruthy(); // per-locale placeholder fallback
    expect(config.footer.zh).toBeTruthy();
    expect(config.footer.en).toBeTruthy(); // non-mapping field falls back whole
  });
});

describe("total-fallback console.warn", () => {
  // vi.resetModules gives each test a freshly loaded module with its own
  // one-time warn flag. The healthiest case (import-time load of the
  // committed site.config.yaml) succeeds, so importing never warns.
  beforeEach(() => {
    vi.resetModules();
  });

  it("warns once per process, naming the file and reason, when the file is missing", async () => {
    const warn = vi.spyOn(console, "warn");
    const { loadSiteConfig: fresh } = await import("@/lib/config/site");
    fresh(path.join(dir, "absent.yaml"));
    fresh(path.join(dir, "absent-again.yaml")); // same process: still one warning
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain("absent.yaml");
    expect(message).toMatch(/could not be read/i);
    expect(message).toMatch(/placeholder/i);
  });

  it("warns when the yaml does not parse", async () => {
    const warn = vi.spyOn(console, "warn");
    const { loadSiteConfig: fresh } = await import("@/lib/config/site");
    const broken = path.join(dir, "broken-warn.yaml");
    writeFileSync(broken, "siteName: {unterminated", "utf-8");
    fresh(broken);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/not valid YAML/i);
  });

  it("warns when the yaml parses but is not a mapping", async () => {
    const warn = vi.spyOn(console, "warn");
    const { loadSiteConfig: fresh } = await import("@/lib/config/site");
    const list = path.join(dir, "list-warn.yaml");
    writeFileSync(list, "- just\n- a\n- list", "utf-8");
    fresh(list);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/not a mapping/i);
  });

  it("stays quiet for a healthy file and for per-field placeholder merges", async () => {
    const warn = vi.spyOn(console, "warn");
    const { loadSiteConfig: fresh } = await import("@/lib/config/site");
    fresh(); // committed site.config.yaml at the project root
    const partial = path.join(dir, "partial-warn.yaml");
    writeFileSync(partial, "siteName: Only Name\n", "utf-8");
    fresh(partial); // per-field merge is normal behavior, not a total fallback
    expect(warn).not.toHaveBeenCalled();
  });
});

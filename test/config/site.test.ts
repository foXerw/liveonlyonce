import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadSiteConfig, siteConfig } from "@/lib/config/site";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "loo-site-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
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

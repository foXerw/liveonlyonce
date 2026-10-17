import { describe, expect, it } from "vitest";
import { classifyAspect, inferKind, parseMomentYaml, resolveText } from "@/lib/content/parse";

describe("inferKind", () => {
  it("maps 0, 1 and >=2 images to text, photo and album", () => {
    expect(inferKind(0)).toBe("text");
    expect(inferKind(1)).toBe("photo");
    expect(inferKind(2)).toBe("album");
    expect(inferKind(9)).toBe("album");
  });
});

describe("classifyAspect", () => {
  it("classifies wide, square and tall", () => {
    expect(classifyAspect(2000, 1000)).toBe("wide");
    expect(classifyAspect(1000, 1000)).toBe("square");
    expect(classifyAspect(800, 1600)).toBe("tall");
  });

  it("applies the documented boundaries", () => {
    expect(classifyAspect(1400, 1000)).toBe("wide"); // ratio exactly 1.4
    expect(classifyAspect(1399, 1000)).toBe("square"); // just under 1.4
    expect(classifyAspect(800, 1000)).toBe("square"); // ratio exactly 0.8
    expect(classifyAspect(799, 1000)).toBe("tall"); // just under 0.8
  });
});

describe("resolveText", () => {
  it("falls back to the other locale, then to empty string", () => {
    expect(resolveText({ zh: "a" }, "en")).toBe("a");
    expect(resolveText({}, "zh")).toBe("");
    expect(resolveText({ zh: "中", en: "x" }, "zh")).toBe("中");
    expect(resolveText({ en: "x" }, "en")).toBe("x");
  });
});

describe("parseMomentYaml", () => {
  it("throws on an impossible date", () => {
    expect(() => parseMomentYaml("date: 2025-13-99", "x")).toThrow();
  });

  it("throws on a calendar-invalid but well-shaped date", () => {
    expect(() =>
      parseMomentYaml("date: 2025-02-30\ntitle:\n  zh: t", "2025-02-30-t"),
    ).toThrow();
  });

  it("throws when the title is missing entirely", () => {
    expect(() => parseMomentYaml("date: 2025-08-15", "2025-08-15-x")).toThrow();
  });

  it("throws when the yaml is not syntactically valid", () => {
    expect(() => parseMomentYaml('title: {zh: "unterminated', "2025-08-15-x")).toThrow();
  });

  it("throws when the document is not a mapping", () => {
    expect(() => parseMomentYaml("- just\n- a\n- list", "2025-08-15-x")).toThrow();
  });

  it("parses a full moment and defaults pinned to false", () => {
    const parsed = parseMomentYaml(
      `date: 2025-08-15
title:
  zh: 环湖小记
  en: Lakeside Circuit
description:
  zh: 描述
  en: Description
location:
  zh: 环湖
  en: Lakeside
`,
      "2025-08-15-lakeside-circuit",
    );
    expect(parsed).toEqual({
      id: "2025-08-15-lakeside-circuit",
      date: "2025-08-15",
      pinned: false,
      title: { zh: "环湖小记", en: "Lakeside Circuit" },
      description: { zh: "描述", en: "Description" },
      location: { zh: "环湖", en: "Lakeside" },
    });
  });

  it("accepts a zh-only title and reads pinned", () => {
    const parsed = parseMomentYaml(
      "date: 2025-11-03\npinned: true\ntitle:\n  zh: 半熟",
      "2025-11-03-half-grown",
    );
    expect(parsed.id).toBe("2025-11-03-half-grown");
    expect(parsed.pinned).toBe(true);
    expect(parsed.title).toEqual({ zh: "半熟" });
    expect(parsed.description).toEqual({});
    expect(parsed.location).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { layoutFor } from "@/lib/detail/layoutFor";
import type { Moment, MomentImage } from "@/lib/types";

const wide: MomentImage = { file: "01.png", width: 1600, height: 900 };
const square: MomentImage = { file: "01.png", width: 1200, height: 1100 };

function makeMoment(overrides: Partial<Moment>): Moment {
  return {
    id: "2026-01-01-test",
    date: "2026-01-01",
    pinned: false,
    title: { zh: "测试", en: "Test" },
    description: {},
    images: [],
    kind: "text",
    poster: null,
    posterAspect: null,
    ...overrides,
  };
}

describe("layoutFor", () => {
  it("maps a multi-image album to the scroll story", () => {
    const moment = makeMoment({
      kind: "album",
      images: [wide, square],
      poster: wide,
      posterAspect: "wide",
    });
    expect(layoutFor(moment)).toBe("story");
  });

  it("maps a single-image photo moment to the feature layout", () => {
    const moment = makeMoment({
      kind: "photo",
      images: [square],
      poster: square,
      posterAspect: "square",
    });
    expect(layoutFor(moment)).toBe("feature");
  });

  it("maps a text-only moment to the reading essay", () => {
    expect(layoutFor(makeMoment({ kind: "text" }))).toBe("essay");
  });
});

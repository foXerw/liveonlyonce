import { describe, expect, it } from "vitest";
import { selectCard } from "@/lib/timeline/selectCard";
import type { Moment, MomentImage } from "@/lib/types";

const wide: MomentImage = { file: "01.png", width: 1600, height: 900 };
const square: MomentImage = { file: "01.png", width: 1200, height: 1100 };
const tall: MomentImage = { file: "01.png", width: 900, height: 1600 };

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

describe("selectCard", () => {
  it("maps an album with a wide poster to 'album'", () => {
    const moment = makeMoment({
      kind: "album",
      images: [wide, wide],
      poster: wide,
      posterAspect: "wide",
    });
    expect(selectCard(moment)).toBe("album");
  });

  it("maps an album with a square poster to 'album'", () => {
    const moment = makeMoment({
      kind: "album",
      images: [square, square],
      poster: square,
      posterAspect: "square",
    });
    expect(selectCard(moment)).toBe("album");
  });

  it("maps an album with a tall poster to 'poster' (vertical poster scene)", () => {
    const moment = makeMoment({
      kind: "album",
      images: [tall, tall],
      poster: tall,
      posterAspect: "tall",
    });
    expect(selectCard(moment)).toBe("poster");
  });

  it("maps a single-image photo moment to 'photo'", () => {
    const moment = makeMoment({
      kind: "photo",
      images: [square],
      poster: square,
      posterAspect: "square",
    });
    expect(selectCard(moment)).toBe("photo");
  });

  it("maps a text-only moment to 'quote'", () => {
    const moment = makeMoment({ kind: "text" });
    expect(selectCard(moment)).toBe("quote");
  });

  it("falls back to 'album' when an album poster has no classified aspect", () => {
    const moment = makeMoment({ kind: "album", images: [wide], poster: wide });
    expect(selectCard(moment)).toBe("album");
  });
});

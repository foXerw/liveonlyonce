import type { Moment } from "@/lib/types";

/** Which timeline card renders a moment (Task 5 brief). */
export type CardKind = "album" | "poster" | "photo" | "quote";

/**
 * album + wide|square poster -> 'album'  (horizontal landscape card)
 * album + tall poster        -> 'poster' (vertical poster scene)
 * photo                      -> 'photo'
 * text                       -> 'quote'  (typographic card, no image)
 *
 * A null posterAspect can only reach an album through malformed data
 * (kind is derived from image count, and any image yields an aspect);
 * fall back to the landscape album card in that case.
 */
export function selectCard(m: Moment): CardKind {
  switch (m.kind) {
    case "album":
      return m.posterAspect === "tall" ? "poster" : "album";
    case "photo":
      return "photo";
    case "text":
      return "quote";
  }
}

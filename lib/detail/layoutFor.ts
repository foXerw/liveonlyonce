import type { Moment } from "@/lib/types";

/** Which narrative renders a moment's detail page (Task 6 brief). */
export type DetailLayout = "story" | "feature" | "essay";

/**
 * album -> 'story'    immersive scroll narrative (plates + reflection)
 * photo -> 'feature'  one large featured image + title/reflection
 * text  -> 'essay'    narrow serif reading column, display-size opening
 *
 * kind is inferred from the image count by the content loader, so the
 * mapping is total — every moment gets exactly one narrative.
 */
export function layoutFor(m: Moment): DetailLayout {
  switch (m.kind) {
    case "album":
      return "story";
    case "photo":
      return "feature";
    case "text":
      return "essay";
  }
}

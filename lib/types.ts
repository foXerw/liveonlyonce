export type Locale = "zh" | "en";
export type LocalizedText = Partial<Record<Locale, string>>;
export type MomentKind = "album" | "photo" | "text";
export type AspectClass = "wide" | "square" | "tall";

export interface MomentImage {
  file: string;
  width: number;
  height: number;
}

export interface Moment {
  id: string; // folder name, e.g. 2026-08-02-coastal-highway
  date: string; // ISO 'YYYY-MM-DD'
  pinned: boolean;
  title: LocalizedText;
  description: LocalizedText;
  location?: LocalizedText;
  images: MomentImage[]; // sorted by file name
  kind: MomentKind;
  poster: MomentImage | null;
  posterAspect: AspectClass | null;
}

export interface YearGroup {
  year: number;
  moments: Moment[];
}

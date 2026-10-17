import type { StaticImageData } from "next/image";

/**
 * Custom next/image loader: `src` is already the product of assetUrl(), which
 * carries its own `?w=` tier, so pass it through untouched. next/image must
 * not rewrite the width behind the {640,1280,1920} whitelist the API route
 * enforces.
 */
export default function mediaLoader(props: {
  src: string | StaticImageData;
  width?: number;
  quality?: number;
}): string {
  const { src } = props;
  return typeof src === "string" ? src : src.src;
}

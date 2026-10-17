import { afterEach, describe, expect, it } from "vitest";
import { siteConfig } from "@/lib/config/site";
import { assetUrl } from "@/lib/media/url";
import { buildPageMetadata, resolveMetadataBase } from "@/lib/seo";

describe("buildPageMetadata", () => {
  it("suffixes the document title with the site name", () => {
    const md = buildPageMetadata({ title: "青海大环线", description: "d" });
    expect(md.title).toBe(`青海大环线 · ${siteConfig.siteName}`);
  });

  it("yields just the site name when the title is blank", () => {
    const md = buildPageMetadata({ title: "   ", description: "d" });
    expect(md.title).toBe(siteConfig.siteName);
  });

  it("passes the description through", () => {
    const md = buildPageMetadata({ title: "x", description: "the moment description" });
    expect(md.description).toBe("the moment description");
    expect(md.openGraph?.description).toBe("the moment description");
  });

  it("points og:image at the 1280 asset when imageFile and momentId are given", () => {
    const md = buildPageMetadata({
      title: "x",
      description: "d",
      imageFile: "01-lake-sunrise.png",
      momentId: "2025-08-15-qinghai-grand-loop",
    });
    expect(md.openGraph?.images).toEqual([
      { url: assetUrl("2025-08-15-qinghai-grand-loop", "01-lake-sunrise.png", 1280) },
    ]);
    expect(md.openGraph?.title).toBe(`x · ${siteConfig.siteName}`);
    expect(md.twitter?.images).toEqual(md.openGraph?.images);
  });

  it("omits the images key entirely when there is no imageFile", () => {
    const md = buildPageMetadata({ title: "x", description: "d", momentId: "m" });
    expect(md.openGraph && "images" in md.openGraph).toBe(false);
    expect(md.twitter && "images" in md.twitter).toBe(false);
  });

  it("omits the images key when imageFile is given without a momentId", () => {
    const md = buildPageMetadata({ title: "x", description: "d", imageFile: "a.png" });
    expect(md.openGraph && "images" in md.openGraph).toBe(false);
    expect(md.twitter && "images" in md.twitter).toBe(false);
  });

  it("always sets the twitter card to summary_large_image", () => {
    const md = buildPageMetadata({ title: "x", description: "d" });
    // Metadata.twitter is a union in Next; "card" only exists on some members.
    expect((md.twitter as { card?: string } | undefined)?.card).toBe("summary_large_image");
  });
});

describe("resolveMetadataBase", () => {
  afterEach(() => {
    delete process.env.SITE_URL;
  });

  it("reads SITE_URL when it is an absolute URL", () => {
    process.env.SITE_URL = "https://moments.example.com";
    const base = resolveMetadataBase();
    expect(base).toBeInstanceOf(URL);
    expect(base?.toString()).toBe("https://moments.example.com/");
  });

  it("returns undefined when SITE_URL is missing, blank or not absolute", () => {
    delete process.env.SITE_URL;
    expect(resolveMetadataBase()).toBeUndefined();
    process.env.SITE_URL = "   ";
    expect(resolveMetadataBase()).toBeUndefined();
    process.env.SITE_URL = "moments.example.com/path"; // no scheme -> new URL throws
    expect(resolveMetadataBase()).toBeUndefined();
  });
});

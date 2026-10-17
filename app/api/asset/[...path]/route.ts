import { NextResponse } from "next/server";
import { contentDir } from "@/lib/content/dir";
import { getTransformed, resolveAssetPath } from "@/lib/media/serve";

const WIDTHS = new Set([640, 1280, 1920]);

export async function GET(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const width = Number(new URL(request.url).searchParams.get("w"));
  if (!WIDTHS.has(width)) {
    return NextResponse.json({ error: "w must be one of 640, 1280, 1920" }, { status: 400 });
  }

  const segments = (await context.params).path ?? [];
  if (segments.length !== 2) return notFound();
  const [momentId, file] = segments;

  const srcAbs = resolveAssetPath(contentDir(), momentId, file);
  if (!srcAbs) return notFound();

  let image;
  try {
    image = await getTransformed(srcAbs, width);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return notFound();
    console.error(`[media] failed to transform "${srcAbs}" at w=${width}:`, error);
    return NextResponse.json({ error: "media transform failed" }, { status: 500 });
  }

  return new Response(image.body as unknown as BodyInit, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

function notFound(): Response {
  return new Response(null, { status: 404 });
}

import { NextResponse } from "next/server";
import { StoreValidationError, createMoment } from "@/lib/admin/store";
import { parseMomentForm } from "@/lib/admin/form";
import { contentDir } from "@/lib/content/dir";
import { loadMoments } from "@/lib/content/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// (No `bodySizeLimit` segment config here — Next 16 does not support it and
// ignores it silently.) Transport cap on upload bodies: next.config.ts
// experimental.proxyClientMaxBodySize ("200mb"). Per-file size and image
// count: lib/admin/limits.ts MAX_IMAGE_BYTES / MAX_IMAGES, enforced by
// lib/admin/store.ts against the parsed form.

export async function GET(): Promise<NextResponse> {
  // The loader skips invalid folders, so this list is exactly the valid moments.
  const moments = await loadMoments(contentDir());
  return NextResponse.json({ moments });
}

export async function POST(request: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const { input, files, fields } = await parseMomentForm(form, { partialFiles: false });
  if (input === null || Object.keys(fields).length > 0) {
    return NextResponse.json({ error: "validation failed", fields }, { status: 400 });
  }

  try {
    const moment = await createMoment(contentDir(), input, files);
    return NextResponse.json({ id: moment.id }, { status: 201 });
  } catch (error) {
    if (error instanceof StoreValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[admin] createMoment failed:", error);
    return NextResponse.json({ error: "could not create moment" }, { status: 500 });
  }
}

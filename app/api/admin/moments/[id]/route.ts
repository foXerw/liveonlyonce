import { NextResponse } from "next/server";
import {
  StoreNotFoundError,
  StoreValidationError,
  deleteMoment,
  updateMoment,
} from "@/lib/admin/store";
import { parseFileDirectives, parseMomentForm } from "@/lib/admin/form";
import { contentDir } from "@/lib/content/dir";
import { MOMENT_FOLDER_RE } from "@/lib/content/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// (No `bodySizeLimit` segment config here — Next 16 does not support it and
// ignores it silently.) Same as the create route: transport cap is
// next.config.ts experimental.proxyClientMaxBodySize ("200mb"); per-file
// size / image count are enforced by lib/admin/store.ts (lib/admin/limits.ts).

/**
 * PATCH merge contract (minimal, documented):
 * - all text fields (date, title[zh|en], description[zh|en], location[zh|en],
 *   pinned) are REQUIRED and rewrite moment.yaml wholesale;
 * - files[]            -> added, existing images are KEPT;
 * - removeFiles        -> written file names deleted (repeatable field);
 * - replaceFiles=true  -> every existing image deleted before files[] are added.
 * There is no partial-text-field update by design (the admin form always posts
 * the whole record). Changing `date` rewrites the yaml only; the folder id
 * keeps its original date prefix.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  // Validate against the loader rule BEFORE building any fs path.
  if (!id || !MOMENT_FOLDER_RE.test(id)) {
    return NextResponse.json({ error: `invalid moment id "${id ?? ""}"` }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const { input, files, fields } = await parseMomentForm(form, { partialFiles: false });
  const directives = parseFileDirectives(form, fields);
  if (input === null || Object.keys(fields).length > 0) {
    return NextResponse.json({ error: "validation failed", fields }, { status: 400 });
  }

  try {
    await updateMoment(contentDir(), id, input, { add: files, ...directives });
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof StoreNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof StoreValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`[admin] updateMoment "${id}" failed:`, error);
    return NextResponse.json({ error: "could not update moment" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!id || !MOMENT_FOLDER_RE.test(id)) {
    return NextResponse.json({ error: `invalid moment id "${id ?? ""}"` }, { status: 400 });
  }

  try {
    await deleteMoment(contentDir(), id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof StoreNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof StoreValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`[admin] deleteMoment "${id}" failed:`, error);
    return NextResponse.json({ error: "could not delete moment" }, { status: 500 });
  }
}

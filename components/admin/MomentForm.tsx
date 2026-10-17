"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { ImageDropzone } from "@/components/admin/ImageDropzone";
import { adminFetch, readJson } from "@/lib/admin/client";
import { t } from "@/lib/i18n/server";
import { assetUrl } from "@/lib/media/url";
import type { Locale, Moment } from "@/lib/types";

export interface MomentFormProps {
  locale: Locale;
  /** Present => edit this moment (PATCH); absent => create (POST). */
  moment?: Moment | null;
  onSaved: (id: string) => void;
  onCancel: () => void;
}

interface FormErrors {
  date?: string;
  title?: string;
  pinned?: string;
  files?: string[];
  general?: string;
}

/** Response shape of the write routes (lib/admin/form.ts field names). */
interface ApiErrorBody {
  error?: string;
  fields?: Record<string, string>;
}

const FIELD =
  "w-full rounded-md border border-blue-ice/15 bg-ink-raised px-3 py-2 text-sm text-blue-ice " +
  "placeholder:text-blue-ice/40 focus-visible:border-blue-bright/60";
const LABEL = "mb-1.5 block text-xs tracking-wide text-blue-ice/70";
const ERROR = "mt-1.5 text-xs text-blue-ice";

function mapServerFields(fields: Record<string, string>): FormErrors {
  const out: FormErrors = {};
  const files: string[] = [];
  const unknown: string[] = [];
  for (const [key, message] of Object.entries(fields)) {
    if (key === "date") out.date = message;
    else if (key === "title") out.title = message;
    else if (key === "pinned") out.pinned = message;
    else if (key === "files" || key === "removeFiles" || key === "replaceFiles") files.push(message);
    else unknown.push(`${key}: ${message}`);
  }
  if (files.length > 0) out.files = files;
  if (unknown.length > 0) out.general = unknown.join("; ");
  return out;
}

/**
 * Create/edit form for one moment. Mirrors the multipart contract of
 * lib/admin/form.ts exactly: date, title[zh|en], description[zh|en],
 * location[zh|en], pinned ("true"/"false"), files[] — and in edit mode the
 * PATCH directives removeFiles (repeatable file names, one per marked
 * existing image) plus an explicit replaceFiles=false (per-image removal
 * covers everything replaceFiles would do, so the UI never wipes all images
 * behind the owner's back). The whole record is always posted — the PATCH
 * route rewrites moment.yaml wholesale.
 */
export function MomentForm({ locale, moment = null, onSaved, onCancel }: MomentFormProps) {
  const editing = moment !== null;
  const [date, setDate] = useState(moment?.date ?? "");
  const [titleZh, setTitleZh] = useState(moment?.title.zh ?? "");
  const [titleEn, setTitleEn] = useState(moment?.title.en ?? "");
  const [descZh, setDescZh] = useState(moment?.description.zh ?? "");
  const [descEn, setDescEn] = useState(moment?.description.en ?? "");
  const [locZh, setLocZh] = useState(moment?.location?.zh ?? "");
  const [locEn, setLocEn] = useState(moment?.location?.en ?? "");
  const [pinned, setPinned] = useState(moment?.pinned ?? false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [removedFiles, setRemovedFiles] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);

  // Images that will remain if this form is saved right now — the dropzone
  // counts them toward MAX_IMAGES so the pre-check matches the store.
  const keptCount = (moment?.images ?? []).filter((img) => !removedFiles.includes(img.file)).length;

  function toggleRemoved(name: string): void {
    setRemovedFiles((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;

    const blocked: FormErrors = {};
    if (date.trim().length === 0) blocked.date = t("admin.dateRequired", locale);
    if (titleZh.trim().length === 0 && titleEn.trim().length === 0) {
      blocked.title = t("admin.titleRequired", locale);
    }
    setErrors(blocked);
    if (Object.keys(blocked).length > 0) return;

    const form = new FormData();
    form.append("date", date.trim());
    form.append("title[zh]", titleZh.trim());
    form.append("title[en]", titleEn.trim());
    form.append("description[zh]", descZh.trim());
    form.append("description[en]", descEn.trim());
    form.append("location[zh]", locZh.trim());
    form.append("location[en]", locEn.trim());
    form.append("pinned", pinned ? "true" : "false");
    for (const file of newFiles) form.append("files[]", file);
    if (editing && moment) {
      for (const name of removedFiles) form.append("removeFiles", name);
      form.append("replaceFiles", "false");
    }

    setBusy(true);
    try {
      const res = await adminFetch(
        editing && moment
          ? `/api/admin/moments/${encodeURIComponent(moment.id)}`
          : "/api/admin/moments",
        { method: editing ? "PATCH" : "POST", body: form },
      );
      if (res.ok) {
        const data = await readJson<{ id?: string }>(res);
        onSaved(data?.id ?? moment?.id ?? "");
        return;
      }
      if (res.status === 401) return; // adminFetch is already redirecting
      const data = await readJson<ApiErrorBody>(res);
      const fields = data?.fields ?? {};
      if (Object.keys(fields).length > 0) {
        setErrors(mapServerFields(fields));
      } else {
        setErrors({ general: data?.error || t("admin.saveFailed", locale) });
      }
    } catch {
      setErrors({ general: t("admin.saveFailed", locale) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="mt-8 space-y-5">
      <h2 className="font-serif-cn text-lg text-blue-ice">
        {editing ? t("admin.edit", locale) : t("admin.newMoment", locale)}
      </h2>

      <div>
        <label htmlFor="mf-date" className={LABEL}>
          {t("admin.date", locale)}
        </label>
        <input
          id="mf-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
          className={`${FIELD} [color-scheme:dark]`}
        />
        {errors.date && <p className={ERROR} role="alert">{errors.date}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="mf-title-zh" className={LABEL}>
            {t("admin.titleZh", locale)}
          </label>
          <input
            id="mf-title-zh"
            type="text"
            value={titleZh}
            onChange={(event) => setTitleZh(event.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="mf-title-en" className={LABEL}>
            {t("admin.titleEn", locale)}
          </label>
          <input
            id="mf-title-en"
            type="text"
            value={titleEn}
            onChange={(event) => setTitleEn(event.target.value)}
            className={FIELD}
          />
        </div>
      </div>
      {errors.title && <p className="-mt-3 text-xs text-blue-ice" role="alert">{errors.title}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="mf-desc-zh" className={LABEL}>
            {t("admin.descZh", locale)}
          </label>
          <textarea
            id="mf-desc-zh"
            rows={4}
            value={descZh}
            onChange={(event) => setDescZh(event.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="mf-desc-en" className={LABEL}>
            {t("admin.descEn", locale)}
          </label>
          <textarea
            id="mf-desc-en"
            rows={4}
            value={descEn}
            onChange={(event) => setDescEn(event.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="mf-loc-zh" className={LABEL}>
            {t("admin.locationZh", locale)}
          </label>
          <input
            id="mf-loc-zh"
            type="text"
            value={locZh}
            onChange={(event) => setLocZh(event.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="mf-loc-en" className={LABEL}>
            {t("admin.locationEn", locale)}
          </label>
          <input
            id="mf-loc-en"
            type="text"
            value={locEn}
            onChange={(event) => setLocEn(event.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="mf-pinned"
          type="checkbox"
          checked={pinned}
          onChange={(event) => setPinned(event.target.checked)}
          className="size-4 cursor-pointer accent-blue-bright"
        />
        <label htmlFor="mf-pinned" className="cursor-pointer text-sm text-blue-ice">
          {t("admin.pinned", locale)}
        </label>
        {errors.pinned && <p className="text-xs text-blue-ice" role="alert">{errors.pinned}</p>}
      </div>

      {editing && moment && moment.images.length > 0 && (
        <div>
          <p className={LABEL}>{t("admin.images", locale)}</p>
          <ul className="flex flex-wrap gap-3">
            {moment.images.map((img) => {
              const removed = removedFiles.includes(img.file);
              return (
                <li key={img.file} className="w-20 text-center">
                  <div className="relative">
                    <Image
                      src={assetUrl(moment.id, img.file, 640)}
                      alt={img.file}
                      width={img.width}
                      height={img.height}
                      unoptimized
                      className={`size-20 rounded-md border border-blue-ice/15 object-cover ${
                        removed ? "opacity-30" : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleRemoved(img.file)}
                      aria-label={t("admin.removeImage", locale)}
                      aria-pressed={removed}
                      className="absolute -right-1.5 -top-1.5 size-5 cursor-pointer rounded-full border border-blue-ice/25 bg-ink text-xs leading-none text-blue-ice/80 transition-colors hover:border-blue-bright/60 hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      ×
                    </button>
                </div>
                <p className="mt-1 truncate text-xs text-blue-ice/70">{img.file}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ImageDropzone
        locale={locale}
        files={newFiles}
        onChange={setNewFiles}
        reservedCount={keptCount}
        errors={errors.files}
      />

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer rounded-md border border-blue-bright/40 bg-blue-deep/40 px-4 py-2 text-sm text-blue-ice transition-colors duration-300 hover:border-blue-bright/70 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          {t("admin.save", locale)}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-md border border-blue-ice/15 px-4 py-2 text-sm text-blue-ice/70 transition-colors duration-300 hover:border-blue-ice/40 hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t("admin.cancel", locale)}
        </button>
      </div>

      {errors.general && (
        <p role="alert" className="text-xs text-blue-ice">
          {errors.general}
        </p>
      )}
    </form>
  );
}

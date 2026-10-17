"use client";

import Image from "next/image";
import { useEffect, useId, useState, type DragEvent, type ChangeEvent } from "react";
import { ALLOWED_EXT, MAX_IMAGES, MAX_IMAGE_BYTES } from "@/lib/admin/limits";
import { t } from "@/lib/i18n/server";
import type { Locale } from "@/lib/types";

export interface ImageDropzoneProps {
  locale: Locale;
  /** Pending new files — controlled by the parent form. */
  files: File[];
  onChange: (next: File[]) => void;
  /**
   * Saved images that will remain on submit (edit mode). They count toward
   * MAX_IMAGES so the preview matches the store's merge arithmetic
   * (kept + new > 60 fails server-side; pre-check it here instead).
   */
  reservedCount?: number;
  /** Server-side "files" field errors, shown under the previews. */
  errors?: string[];
}

interface Feedback {
  /** Catalog key of the message (admin.tooManyImages / admin.tooLarge / …). */
  key: string;
  /** Offending file names, rendered as a separate span so the message text
   *  stays an exact catalog string (stable for tests and screen readers). */
  names: string[];
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "";
  return name.slice(dot + 1).toLowerCase();
}

/**
 * File picker + drop area with client-side pre-checks mirroring the store
 * limits (extension, size, count). Rejected files never reach the parent's
 * list, so a save below the cap is one clean round-trip; the server still
 * validates everything regardless. Thumbnails use blob object URLs via
 * next/image `unoptimized` (the custom media loader is for /api/asset URLs
 * only, and there is nothing to resize here).
 */
export function ImageDropzone({
  locale,
  files,
  onChange,
  reservedCount = 0,
  errors = [],
}: ImageDropzoneProps) {
  const inputId = useId();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [dragActive, setDragActive] = useState(false);

  function accept(incoming: FileList | File[]): void {
    const accepted: File[] = [];
    const problems = new Map<string, string[]>();
    let total = reservedCount + files.length;

    for (const file of Array.from(incoming)) {
      // Browsers hand out a fresh File object per selection, so identity
      // dedupe is not enough — same name + size counts as the same pick
      // (against both the pending list and this selection's own accepts).
      const dup = [...files, ...accepted].some(
        (f) => f.name === file.name && f.size === file.size,
      );
      if (dup) continue;
      const reject = (key: string) => {
        const names = problems.get(key) ?? [];
        names.push(file.name);
        problems.set(key, names);
      };
      if (!ALLOWED_EXT.includes(extensionOf(file.name))) {
        reject("admin.badImageType");
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        reject("admin.tooLarge");
        continue;
      }
      if (total + 1 > MAX_IMAGES) {
        reject("admin.tooManyImages");
        continue;
      }
      accepted.push(file);
      total += 1;
    }

    setFeedback(
      [...problems.entries()].map(([key, names]) => ({ key, names })),
    );
    if (accepted.length > 0) onChange([...files, ...accepted]);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files && event.target.files.length > 0) accept(event.target.files);
    event.target.value = ""; // allow re-picking the same file later
  }

  function onDrop(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files.length > 0) accept(event.dataTransfer.files);
  }

  function removeTile(file: File): void {
    onChange(files.filter((f) => f !== file)); // the tile's unmount revokes its URL
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-6 text-center transition-colors duration-300 ${
          dragActive
            ? "border-blue-bright/70 bg-blue-deep/30"
            : "border-blue-ice/20 bg-ink-raised/60 hover:border-blue-ice/40"
        }`}
      >
        <input
          id={inputId}
          // aria-label (not just the visible label text) keeps the accessible
          // name exactly "Images" even though the hint shares the label.
          aria-label={t("admin.images", locale)}
          type="file"
          multiple
          accept={ALLOWED_EXT.map((ext) => `.${ext}`).join(",")}
          className="sr-only"
          onChange={onInputChange}
        />
        <span className="text-sm text-blue-ice">{t("admin.images", locale)}</span>
        <span className="text-xs text-blue-ice/60">{t("admin.dropHint", locale)}</span>
      </label>

      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3">
          {files.map((file) => (
            <PreviewTile
              // name+size is stable enough for previews (duplicates of the
              // exact same pick are filtered in accept()).
              key={`${file.name}-${file.size}-${file.lastModified}`}
              file={file}
              locale={locale}
              onRemove={() => removeTile(file)}
            />
          ))}
        </ul>
      )}

      {feedback.length > 0 && (
        <ul role="alert" className="mt-2 space-y-1 text-xs text-blue-ice">
          {feedback.map(({ key, names }) => (
            <li key={key}>
              <span>{t(key, locale)}</span> <span className="text-blue-ice/70">{names.join(", ")}</span>
            </li>
          ))}
        </ul>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="mt-2 space-y-1 text-xs text-blue-ice">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One pending-file tile. The blob object URL lives in the tile's own lazy
 * initial state (a ref-based URL cache would have to be read during render,
 * which react-hooks/refs forbids) and is revoked when the tile unmounts —
 * i.e. when the file is removed or the form closes. Under StrictMode's
 * double-invoke the discarded URL is unreachable but harmless in dev only.
 */
function PreviewTile({
  file,
  locale,
  onRemove,
}: {
  file: File;
  locale: Locale;
  onRemove: (file: File) => void;
}) {
  const [url] = useState(() =>
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(file)
      : undefined,
  );
  useEffect(
    () => () => {
      if (url && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
    },
    [url],
  );

  return (
    <li className="w-20 text-center">
      <div className="relative">
        {url ? (
          <Image
            src={url}
            alt={file.name}
            width={128}
            height={128}
            unoptimized
            className="size-20 rounded-md border border-blue-ice/15 object-cover"
          />
        ) : (
          <div className="size-20 rounded-md border border-blue-ice/15 bg-ink-raised" />
        )}
        <button
          type="button"
          onClick={() => onRemove(file)}
          aria-label={t("admin.removeImage", locale)}
          className="absolute -right-1.5 -top-1.5 size-5 cursor-pointer rounded-full border border-blue-ice/25 bg-ink text-xs leading-none text-blue-ice/80 transition-colors hover:border-blue-bright/60 hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ×
        </button>
      </div>
      <p className="mt-1 truncate text-xs text-blue-ice/70">{file.name}</p>
    </li>
  );
}

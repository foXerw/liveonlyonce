"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface LightboxImage {
  /** Pre-sized asset URL — the lightbox always shows the 1920 tier. */
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface LightboxLabels {
  /** Accessible name of the dialog itself (lightbox.title). */
  title: string;
  close: string;
  prev: string;
  next: string;
}

export interface MomentLightboxProps {
  images: LightboxImage[];
  labels: LightboxLabels;
  onClose: () => void;
  initialIndex?: number;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Full-screen image viewer. Mounted only while open (the caller renders it
 * conditionally), so mount/unmount effects carry the whole open/close
 * lifecycle: focus moves to the close button, body scroll locks, and on
 * close both are restored — focus returns to whatever opened the lightbox.
 * Keyboard: Escape closes, Left/Right cycle (wrapping), Tab stays inside.
 *
 * The dialog is portaled to document.body: `position: fixed` is only
 * viewport-relative while no ancestor carries a transform/filter/will-change
 * — and the homepage trigger sits inside the Timeline's scroll-reveal
 * container, whose animation sets a transform mid-scroll (a transformed
 * ancestor becomes the containing block for fixed descendants, which would
 * clip the dialog to the card). The portal also immunizes the overlay
 * against any future hover transforms on card containers.
 */
export function MomentLightbox({
  images,
  labels,
  onClose,
  initialIndex = 0,
}: MomentLightboxProps) {
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)),
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const step = useCallback(
    (delta: number) => {
      setIndex((current) => (current + delta + images.length) % images.length);
    },
    [images.length],
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (images.length > 1) {
        if (event.key === "ArrowRight") {
          step(1);
          return;
        }
        if (event.key === "ArrowLeft") {
          step(-1);
          return;
        }
      }
      if (event.key === "Tab") {
        const focusable = dialogRef.current
          ? [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
          : [];
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        const inside = dialogRef.current?.contains(active);
        if (event.shiftKey && (!inside || active === first)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (!inside || active === last)) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [images.length, onClose, step]);

  if (images.length === 0) return null;
  // Only ever mounted through user interaction, but guard SSR anyway —
  // the portal target must be the real document.body.
  if (typeof document === "undefined") return null;
  const current = images[index];
  const many = images.length > 1;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      // Clicks landing on the dialog element itself hit the empty backdrop
      // padding around the image — those close; clicks on content do not.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="reveal-load fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 p-4 md:p-10"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex size-10 cursor-pointer items-center justify-center rounded-full border border-blue-ice/15 bg-ink/70 text-blue-ice/80 transition-colors duration-300 hover:border-blue-bright/50 hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-2 md:right-6 md:top-6 md:size-11"
      >
        <XIcon />
        <span className="sr-only">{labels.close}</span>
      </button>

      {many && (
        <button
          type="button"
          onClick={() => step(-1)}
          className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-blue-ice/15 bg-ink/70 text-blue-ice/80 transition-colors duration-300 hover:border-blue-bright/50 hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-2 md:left-6 md:size-11"
        >
          <ChevronIcon direction="left" />
          <span className="sr-only">{labels.prev}</span>
        </button>
      )}

      <figure className="flex max-h-full max-w-full items-center justify-center">
        {/* unoptimized: src is already the on-demand 1920-tier asset URL; the
            overlay must not go through another resize layer. */}
        <Image
          src={current.src}
          width={current.width}
          height={current.height}
          alt={current.alt}
          unoptimized
          className="h-auto max-h-[82vh] w-auto max-w-[92vw] object-contain md:max-w-[86vw]"
        />
      </figure>

      {many && (
        <button
          type="button"
          onClick={() => step(1)}
          className="absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-blue-ice/15 bg-ink/70 text-blue-ice/80 transition-colors duration-300 hover:border-blue-bright/50 hover:text-blue-ice focus-visible:outline-2 focus-visible:outline-offset-2 md:right-6 md:size-11"
        >
          <ChevronIcon direction="right" />
          <span className="sr-only">{labels.next}</span>
        </button>
      )}
    </div>,
    document.body,
  );
}

export interface MomentLightboxTriggerProps {
  images: LightboxImage[];
  labels: LightboxLabels;
  /** Server-rendered content — a link to the moment's detail page. */
  children: ReactNode;
}

/**
 * Progressive-enhancement lightbox opener. Wraps the server-rendered link:
 * with scripting disabled the link simply navigates to the detail page (the
 * lightbox never exists in the SSR HTML); with JS a plain left click is
 * intercepted and the lightbox opens instead. Modifier clicks and non-primary
 * buttons are left alone so "open in new tab" still works. `display: contents`
 * keeps the wrapper out of the surrounding layout.
 */
export function MomentLightboxTrigger({
  images,
  labels,
  children,
}: MomentLightboxTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="contents"
      onClickCapture={(event) => {
        if (
          event.button !== 0 ||
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        const target = event.target as Element | null;
        if (!target?.closest("a[href]")) return;
        event.preventDefault();
        setOpen(true);
      }}
    >
      {children}
      {open && (
        <MomentLightbox
          images={images}
          labels={labels}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

function XIcon() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      className="size-[15px]"
    >
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="size-4"
    >
      <path
        d={direction === "left" ? "M9.5 3.5 5 8l4.5 4.5" : "M6.5 3.5 11 8l-4.5 4.5"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

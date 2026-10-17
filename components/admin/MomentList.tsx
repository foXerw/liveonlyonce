"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { MomentForm } from "@/components/admin/MomentForm";
import { adminFetch, readJson } from "@/lib/admin/client";
import { t } from "@/lib/i18n/server";
import { assetUrl } from "@/lib/media/url";
import type { Locale, Moment } from "@/lib/types";

type View = { kind: "list" } | { kind: "new" } | { kind: "edit"; moment: Moment };

const GHOST_BUTTON =
  "cursor-pointer rounded-md border border-blue-ice/15 px-3 py-1.5 text-xs text-blue-ice/70 " +
  "transition-colors duration-300 hover:border-blue-ice/40 hover:text-blue-ice " +
  "focus-visible:outline-2 focus-visible:outline-offset-2";

/** GET /api/admin/moments returns loadMoments' strict date-desc order;
 *  re-sorting client-side only guards against accidental API drift. */
function byDateDesc(a: Moment, b: Moment): number {
  return b.date.localeCompare(a.date);
}

/**
 * The admin dashboard body: the list of moments (thumbnail, zh title with
 * en fallback, date, pinned marker, edit/delete) plus the create/edit form.
 * Auth is middleware's job — a 401 here means the session expired mid-view
 * and adminFetch bounces the owner to the login page.
 */
export function MomentList({ locale }: { locale: Locale }) {
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });
  const [status, setStatus] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await adminFetch("/api/admin/moments");
      if (!res.ok) {
        setLoadError(t("admin.loadFailed", locale));
        return;
      }
      const data = await readJson<{ moments?: Moment[] }>(res);
      setMoments([...(data?.moments ?? [])].sort(byDateDesc));
      setLoadError(null);
    } catch {
      setLoadError(t("admin.loadFailed", locale));
    }
  }, [locale]);

  useEffect(() => {
    // Mount-time data fetch: every setState in refresh() lands in an awaited
    // continuation, never the synchronous effect body. react-hooks v6's
    // set-state-in-effect flags any setState reachable from here, but for a
    // fetch-on-mount + refetch-after-mutation flow this is the intended use.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function removeMoment(moment: Moment): Promise<void> {
    // Native confirm is enough for a single-owner tool.
    if (!window.confirm(t("admin.confirmDelete", locale))) return;
    try {
      const res = await adminFetch(`/api/admin/moments/${encodeURIComponent(moment.id)}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 404) {
        // 204 => gone; 404 => it was already deleted elsewhere — both "done".
        setView((v) => (v.kind === "edit" && v.moment.id === moment.id ? { kind: "list" } : v));
        setStatus(t("admin.deleted", locale));
        await refresh();
      } else if (res.status !== 401) {
        setStatus(t("admin.deleteFailed", locale));
      }
    } catch {
      setStatus(t("admin.deleteFailed", locale));
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-blue-ice/70">
          {moments === null ? t("admin.loading", locale) : ""}
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus(null);
            setView({ kind: "new" });
          }}
          className="cursor-pointer rounded-md border border-blue-bright/40 bg-blue-deep/40 px-3 py-1.5 text-xs text-blue-ice transition-colors duration-300 hover:border-blue-bright/70 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          + {t("admin.newMoment", locale)}
        </button>
      </div>

      <p role="status" aria-live="polite" className="mt-2 min-h-4 text-xs text-blue-bright">
        {status ?? ""}
      </p>
      {loadError && (
        <p role="alert" className="mt-2 text-xs text-blue-ice">
          {loadError}
        </p>
      )}

      {view.kind !== "list" && (
        <MomentForm
          key={view.kind === "new" ? "new" : view.moment.id}
          locale={locale}
          moment={view.kind === "edit" ? view.moment : null}
          onCancel={() => setView({ kind: "list" })}
          onSaved={() => {
            setView({ kind: "list" });
            setStatus(t("admin.saved", locale));
            void refresh();
          }}
        />
      )}

      {moments !== null && moments.length === 0 && (
        <p className="mt-8 text-sm text-blue-ice/70">{t("admin.noMoments", locale)}</p>
      )}

      {moments !== null && moments.length > 0 && (
        <ul className="mt-4 divide-y divide-blue-ice/[0.08] border-t border-blue-ice/[0.08]">
          {moments.map((moment) => {
            const title = moment.title.zh ?? moment.title.en ?? moment.id;
            const thumb = moment.poster ?? moment.images[0] ?? null;
            return (
              <li key={moment.id} className="flex items-center gap-4 py-3">
                <div className="size-16 shrink-0 overflow-hidden rounded-md border border-blue-ice/10 bg-ink-raised">
                  {thumb && (
                    <Image
                      src={assetUrl(moment.id, thumb.file, 640)}
                      alt=""
                      width={thumb.width}
                      height={thumb.height}
                      unoptimized
                      className="size-16 object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-blue-ice">{title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-blue-ice/60">
                    <time dateTime={moment.date}>{moment.date}</time>
                    {moment.pinned && (
                      <span className="tracking-[0.18em] text-blue-bright/85">
                        {t("card.pinned", locale)}
                      </span>
                    )}
                    <span className="truncate text-blue-ice/55">{moment.id}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStatus(null);
                      setView({ kind: "edit", moment });
                    }}
                    className={GHOST_BUTTON}
                  >
                    {t("admin.edit", locale)}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeMoment(moment)}
                    className={GHOST_BUTTON}
                  >
                    {t("admin.delete", locale)}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

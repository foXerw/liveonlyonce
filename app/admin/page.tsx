import { headers } from "next/headers";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { MomentList } from "@/components/admin/MomentList";
import { getLocale, t } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Dashboard shell — a server component behind middleware's auth gate; the
 * interactive parts (list, form, logout) are the client tree below it.
 */
export default async function AdminPage() {
  const locale = getLocale(await headers());

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 md:px-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif-cn text-2xl tracking-[0.04em] text-blue-ice">
          {t("admin.title", locale)}
        </h1>
        <LogoutButton locale={locale} />
      </div>
      <MomentList locale={locale} />
    </main>
  );
}

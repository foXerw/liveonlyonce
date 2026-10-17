import { headers } from "next/headers";
import { PasscodeForm } from "@/components/admin/PasscodeForm";
import { getLocale, t } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Public login page (middleware whitelists exactly this path under /admin).
 * Server component: everything interactive lives in PasscodeForm.
 */
export default async function AdminLoginPage() {
  const locale = getLocale(await headers());

  return (
    <main className="mx-auto w-full max-w-sm px-5 py-16 md:px-8">
      <h1 className="font-serif-cn text-2xl tracking-[0.04em] text-blue-ice">
        {t("admin.title", locale)}
      </h1>
      <PasscodeForm locale={locale} />
    </main>
  );
}

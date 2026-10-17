/**
 * Shared fetch plumbing for the admin browser UI (imported by client
 * components only — touches `window`). Used by MomentForm, MomentList and
 * LogoutButton; the login form deliberately does NOT use it, because a 401
 * there is the normal "wrong passcode" signal rather than an expired session.
 */

/**
 * fetch() with the session-expiry convention baked in: middleware.ts answers
 * 401 for every /api/admin/* call without a valid cookie, so any 401 from
 * here means "the session died mid-page" — send the owner back to the login
 * page instead of failing deep inside a component.
 */
export async function adminFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    // Not a component, so useRouter is unavailable; and a hard navigation is
    // wanted anyway — it discards the stale authed client tree wholesale.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/admin/login");
  }
  return res;
}

/** Best-effort JSON body read — error pages may send non-JSON or no body. */
export async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

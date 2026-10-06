/**
 * Minimal access gate for dashboard + mutating APIs (Path B5).
 *
 * When `DASHBOARD_ACCESS_TOKEN` is unset, requests are allowed only when
 * `ENVIRONMENT=local`; otherwise 503 (fail closed). When set, require `Authorization: Bearer <token>` or `?access_token=` /
 * cookie `cp_access`.
 */

export function isLocal(env: { ENVIRONMENT?: string }): boolean {
  return env.ENVIRONMENT === "local";
}

export function secretMissing(
  secret: string | undefined,
  env: { ENVIRONMENT?: string },
  name: string,
): boolean {
  if (secret?.trim() || isLocal(env)) return false;
  console.error(JSON.stringify({ event: "secret_missing", secret: name }));
  return true;
}

export function accessTokenFromEnv(env: { DASHBOARD_ACCESS_TOKEN?: string }): string | undefined {
  const t = env.DASHBOARD_ACCESS_TOKEN?.trim();
  return t || undefined;
}

export function extractAccessToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const url = new URL(req.url);
  const q = url.searchParams.get("access_token");
  if (q) return q;
  const cookie = req.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)cp_access=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : null;
}

export function authorizeRequest(
  req: Request,
  env: { DASHBOARD_ACCESS_TOKEN?: string; ENVIRONMENT?: string },
): { ok: true } | { ok: false; status: 401 | 503; error: string } {
  const expected = accessTokenFromEnv(env);
  if (!expected) {
    return secretMissing(expected, env, "DASHBOARD_ACCESS_TOKEN")
      ? { ok: false, status: 503, error: "secret_missing" }
      : { ok: true };
  }
  const got = extractAccessToken(req);
  if (got && got === expected) return { ok: true };
  return { ok: false, status: 401, error: "unauthorized" };
}

/** Plans that may mutate watches / enqueue crawls. */
export function planAllowsMutations(status: string, plan: string): boolean {
  if (status === "cancelled" || status === "expired" || status === "failed") return false;
  if (status === "on_hold" || status === "paused") return false;
  // trial / starter / pro with none|active|renewed ok
  return plan === "trial" || plan === "starter" || plan === "pro";
}

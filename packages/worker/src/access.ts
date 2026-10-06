/**
 * Minimal access gate for dashboard + mutating APIs (Path B5).
 *
 * When `DASHBOARD_ACCESS_TOKEN` is unset, requests are allowed only when
 * `ENVIRONMENT=local`; otherwise 503 (fail closed). When set, require `Authorization: Bearer <token>` or
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
  const cookie = req.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)cp_access=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Compares without an early exit on length or on the first differing byte. */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export type Principal = { role: "admin" } | { role: "workspace"; workspaceId: string };

export type AuthResult =
  { ok: true; principal: Principal } | { ok: false; status: 401 | 503; error: string };

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 256 bits of entropy; shown once, only its hash is stored. */
export function generateWorkspaceToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `cpw_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Admin token (`DASHBOARD_ACCESS_TOKEN`) → admin. A workspace token → that
 * workspace only. No credentials: admin in `ENVIRONMENT=local`, else 503/401.
 */
export async function authorizeRequest(
  req: Request,
  env: { DASHBOARD_ACCESS_TOKEN?: string; ENVIRONMENT?: string },
  findWorkspaceByTokenHash: (hash: string) => Promise<{ id: string } | undefined>,
): Promise<AuthResult> {
  const expected = accessTokenFromEnv(env);
  const got = extractAccessToken(req);
  if (expected && got && constantTimeEqual(got, expected)) {
    return { ok: true, principal: { role: "admin" } };
  }
  if (got) {
    const ws = await findWorkspaceByTokenHash(await hashToken(got));
    if (ws) return { ok: true, principal: { role: "workspace", workspaceId: ws.id } };
  }
  if (!expected) {
    return secretMissing(expected, env, "DASHBOARD_ACCESS_TOKEN")
      ? { ok: false, status: 503, error: "secret_missing" }
      : { ok: true, principal: { role: "admin" } };
  }
  return { ok: false, status: 401, error: "unauthorized" };
}

/** Plans that may mutate watches / enqueue crawls. */
export function planAllowsMutations(status: string, plan: string): boolean {
  if (status === "cancelled" || status === "expired" || status === "failed") return false;
  if (status === "on_hold" || status === "paused") return false;
  // trial / starter / pro with none|active|renewed ok
  return plan === "trial" || plan === "starter" || plan === "pro";
}

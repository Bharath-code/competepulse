/**
 * Build-time configuration for the landing page.
 *
 * Every value is resolved from env by a pure function so it can be unit tested
 * without a build, and so a missing/typo'd booking link fails loudly in CI
 * instead of silently shipping a dead call-to-action.
 */

export interface LandingEnv {
  PUBLIC_SITE_URL?: string;
  PUBLIC_CALENDLY_URL?: string;
  PUBLIC_CONTACT_EMAIL?: string;
  PUBLIC_APP_URL?: string;
}

export interface LandingConfig {
  /** Canonical origin, no trailing slash. */
  siteUrl: string;
  /** Calendly scheduling link, or `null` when unset (CTA falls back to email). */
  calendlyUrl: string | null;
  contactEmail: string;
  /** Product/dashboard origin, or `null` to hide product links entirely. */
  appUrl: string | null;
}

export const DEFAULT_SITE_URL = "https://competepulse.com";
export const DEFAULT_CONTACT_EMAIL = "hello@competepulse.com";

/** Calendly links look like `calendly.com/<user>/<event>`. */
const CALENDLY_HOST = /(^|\.)calendly\.com$/;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function requireHttpUrl(raw: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} must be an absolute URL, got: ${JSON.stringify(raw)}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${label} must use http(s), got: ${url.protocol}`);
  }
  return url;
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveConfig(env: LandingEnv = {}): LandingConfig {
  const siteUrlRaw = optional(env.PUBLIC_SITE_URL) ?? DEFAULT_SITE_URL;
  const siteUrl = stripTrailingSlash(requireHttpUrl(siteUrlRaw, "PUBLIC_SITE_URL").toString());

  const calendlyRaw = optional(env.PUBLIC_CALENDLY_URL);
  let calendlyUrl: string | null = null;
  if (calendlyRaw) {
    const url = requireHttpUrl(calendlyRaw, "PUBLIC_CALENDLY_URL");
    if (!CALENDLY_HOST.test(url.hostname)) {
      throw new Error(`PUBLIC_CALENDLY_URL must be a calendly.com link, got: ${url.hostname}`);
    }
    calendlyUrl = stripTrailingSlash(url.toString());
  }

  const appRaw = optional(env.PUBLIC_APP_URL);
  const appUrl = appRaw
    ? stripTrailingSlash(requireHttpUrl(appRaw, "PUBLIC_APP_URL").toString())
    : null;

  return {
    siteUrl,
    calendlyUrl,
    contactEmail: optional(env.PUBLIC_CONTACT_EMAIL) ?? DEFAULT_CONTACT_EMAIL,
    appUrl,
  };
}

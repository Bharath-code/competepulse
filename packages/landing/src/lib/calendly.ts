/**
 * Calendly link helpers.
 *
 * The embed and the plain link share one URL builder so the theme, the UTM
 * attribution and the GDPR-banner suppression can never drift apart.
 */

export interface CalendlyEmbedTheme {
  /** Hex colours WITHOUT the leading `#` — Calendly rejects encoded hashes. */
  backgroundColor: string;
  textColor: string;
  primaryColor: string;
}

/** Matches the booking panel the embed is mounted inside. */
export const CALENDLY_THEME: CalendlyEmbedTheme = {
  backgroundColor: "f0f6f9",
  textColor: "121c26",
  primaryColor: "cb2d26",
};

export interface CalendlyLinkOptions {
  /** Where on the page the click came from, e.g. `hero` — becomes utm_content. */
  placement?: string;
  /** Adds the styling params Calendly only honours inside an embed. */
  embed?: boolean;
  theme?: CalendlyEmbedTheme;
  utmSource?: string;
  utmCampaign?: string;
}

const HEX = /^[0-9a-f]{6}$/i;

function assertHex(value: string, label: string): string {
  if (!HEX.test(value)) {
    throw new Error(`${label} must be a 6-digit hex colour without "#", got: ${value}`);
  }
  return value.toLowerCase();
}

/**
 * Decorate a Calendly scheduling link. Returns `null` when no link is
 * configured so callers can render an email fallback instead of a dead button.
 */
export function buildCalendlyUrl(
  baseUrl: string | null,
  options: CalendlyLinkOptions = {},
): string | null {
  if (!baseUrl) return null;

  const url = new URL(baseUrl);
  const params = url.searchParams;

  params.set("hide_gdpr_banner", "1");
  params.set("utm_source", options.utmSource ?? "landing");
  params.set("utm_medium", options.embed ? "embed" : "cta");
  params.set("utm_campaign", options.utmCampaign ?? "design-partners");
  if (options.placement) params.set("utm_content", options.placement);

  if (options.embed) {
    const theme = options.theme ?? CALENDLY_THEME;
    params.set("hide_event_type_details", "0");
    params.set("background_color", assertHex(theme.backgroundColor, "backgroundColor"));
    params.set("text_color", assertHex(theme.textColor, "textColor"));
    params.set("primary_color", assertHex(theme.primaryColor, "primaryColor"));
  }

  return url.toString();
}

/** `mailto:` fallback used whenever `PUBLIC_CALENDLY_URL` is not configured. */
export function buildMailtoFallback(email: string, subject: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

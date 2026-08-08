import { describe, expect, it } from "vitest";
import { CALENDLY_DARK_THEME, buildCalendlyUrl, buildMailtoFallback } from "../src/lib/calendly.js";

const BASE = "https://calendly.com/competepulse/15min";

describe("buildCalendlyUrl", () => {
  it("returns null when no link is configured", () => {
    expect(buildCalendlyUrl(null)).toBeNull();
  });

  it("suppresses the duplicate GDPR banner and tags attribution", () => {
    const url = new URL(buildCalendlyUrl(BASE, { placement: "hero" })!);
    expect(url.searchParams.get("hide_gdpr_banner")).toBe("1");
    expect(url.searchParams.get("utm_source")).toBe("landing");
    expect(url.searchParams.get("utm_medium")).toBe("cta");
    expect(url.searchParams.get("utm_campaign")).toBe("design-partners");
    expect(url.searchParams.get("utm_content")).toBe("hero");
  });

  it("marks embedded views separately from plain link clicks", () => {
    const url = new URL(buildCalendlyUrl(BASE, { embed: true })!);
    expect(url.searchParams.get("utm_medium")).toBe("embed");
    expect(url.searchParams.get("background_color")).toBe(CALENDLY_DARK_THEME.backgroundColor);
    expect(url.searchParams.get("text_color")).toBe(CALENDLY_DARK_THEME.textColor);
    expect(url.searchParams.get("primary_color")).toBe(CALENDLY_DARK_THEME.primaryColor);
  });

  it("omits embed-only theming from plain links", () => {
    const url = new URL(buildCalendlyUrl(BASE)!);
    expect(url.searchParams.has("background_color")).toBe(false);
  });

  it("keeps query params already present on the configured link", () => {
    const url = new URL(buildCalendlyUrl(`${BASE}?month=2026-09`)!);
    expect(url.searchParams.get("month")).toBe("2026-09");
    expect(url.searchParams.get("hide_gdpr_banner")).toBe("1");
  });

  it("allows overriding campaign attribution", () => {
    const url = new URL(buildCalendlyUrl(BASE, { utmSource: "outbound", utmCampaign: "p0" })!);
    expect(url.searchParams.get("utm_source")).toBe("outbound");
    expect(url.searchParams.get("utm_campaign")).toBe("p0");
  });

  it("rejects theme colours Calendly would silently ignore", () => {
    expect(() =>
      buildCalendlyUrl(BASE, {
        embed: true,
        theme: { ...CALENDLY_DARK_THEME, primaryColor: "#3d9cf0" },
      }),
    ).toThrow(/hex colour/);
  });
});

describe("buildMailtoFallback", () => {
  it("encodes the subject line", () => {
    expect(buildMailtoFallback("hello@competepulse.com", "CompetePulse — 15-min call")).toBe(
      "mailto:hello@competepulse.com?subject=CompetePulse%20%E2%80%94%2015-min%20call",
    );
  });
});

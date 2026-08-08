import { describe, expect, it } from "vitest";
import { DEFAULT_CONTACT_EMAIL, DEFAULT_SITE_URL, resolveConfig } from "../src/lib/config.js";

describe("resolveConfig", () => {
  it("falls back to production defaults when nothing is set", () => {
    const config = resolveConfig({});
    expect(config.siteUrl).toBe(DEFAULT_SITE_URL);
    expect(config.contactEmail).toBe(DEFAULT_CONTACT_EMAIL);
    expect(config.calendlyUrl).toBeNull();
    expect(config.appUrl).toBeNull();
  });

  it("normalises trailing slashes so canonical URLs never double up", () => {
    const config = resolveConfig({
      PUBLIC_SITE_URL: "https://competepulse.com/",
      PUBLIC_APP_URL: "https://app.competepulse.com///",
    });
    expect(config.siteUrl).toBe("https://competepulse.com");
    expect(config.appUrl).toBe("https://app.competepulse.com");
  });

  it("treats blank env values as unset", () => {
    const config = resolveConfig({ PUBLIC_CALENDLY_URL: "   ", PUBLIC_CONTACT_EMAIL: "" });
    expect(config.calendlyUrl).toBeNull();
    expect(config.contactEmail).toBe(DEFAULT_CONTACT_EMAIL);
  });

  it("accepts a Calendly event link", () => {
    const config = resolveConfig({ PUBLIC_CALENDLY_URL: "https://calendly.com/team/15min" });
    expect(config.calendlyUrl).toBe("https://calendly.com/team/15min");
  });

  it("rejects a booking link that is not on calendly.com", () => {
    expect(() => resolveConfig({ PUBLIC_CALENDLY_URL: "https://cal.com/team/15min" })).toThrow(
      /calendly\.com/,
    );
  });

  it("rejects a relative booking link instead of shipping a dead button", () => {
    expect(() => resolveConfig({ PUBLIC_CALENDLY_URL: "/book" })).toThrow(/absolute URL/);
  });

  it("rejects a non-http scheme", () => {
    expect(() => resolveConfig({ PUBLIC_SITE_URL: "ftp://competepulse.com" })).toThrow(/http/);
  });
});

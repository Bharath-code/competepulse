import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_URL = "https://competepulse.test";
const CALENDLY_URL = "https://calendly.com/competepulse/15min";

/** Build into node_modules so the deployable `dist/` is never clobbered by tests. */
function build(name: string, env: Record<string, string>): string {
  const outDir = join(pkgRoot, "node_modules/.cache/landing-build", name);
  rmSync(outDir, { recursive: true, force: true });
  execFileSync("node_modules/.bin/astro", ["build", "--outDir", outDir], {
    cwd: pkgRoot,
    stdio: "pipe",
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", PUBLIC_SITE_URL: SITE_URL, ...env },
  });
  return outDir;
}

function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("built page (booking link configured)", () => {
  let outDir: string;
  let html: string;

  beforeAll(() => {
    outDir = build("configured", { PUBLIC_CALENDLY_URL: CALENDLY_URL });
    html = readFileSync(join(outDir, "index.html"), "utf8");
  });

  it("leads with the job-to-be-done headline in a single h1", () => {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/g) ?? [];
    expect(h1).toHaveLength(1);
    const text = textOf(h1[0]!);
    expect(text).toMatch(/Every morning in Slack/);
    expect(text).toMatch(/materially changed on your competitors/);
    expect(text).toMatch(/with links/);
  });

  it("states the pitch sentence and both anti-positions", () => {
    const text = textOf(html);
    expect(text).toMatch(/pricing and changelog pages/);
    expect(text).toMatch(/cited digest/);
    expect(text).toMatch(/No Klue bill/);
    expect(text).toMatch(/No Visualping noise/);
    expect(text).toMatch(/Free 14-day concierge/);
  });

  it("routes every call-to-action to the single booking section", () => {
    const ctas = [...html.matchAll(/<a[^>]*data-cta-placement="([^"]+)"[^>]*>/g)];
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    for (const [tag] of ctas) expect(tag).toMatch(/href="#book"/);
    expect(html).toMatch(/id="book"/);
    expect(textOf(html)).toContain("Book a 15-min discovery call");
  });

  it("hands the themed, attributed Calendly URL to the embed", () => {
    const match = html.match(/data-calendly-url="([^"]+)"/);
    expect(match).not.toBeNull();
    const url = new URL(match![1].replaceAll("&#38;", "&").replaceAll("&amp;", "&"));
    expect(url.origin + url.pathname).toBe(CALENDLY_URL);
    expect(url.searchParams.get("hide_gdpr_banner")).toBe("1");
    expect(url.searchParams.get("utm_medium")).toBe("embed");
    expect(url.searchParams.get("background_color")).toBe("f5f2ea");
  });

  it("keeps a working booking link for visitors the embed never reaches", () => {
    expect(html).toMatch(new RegExp(`href="${CALENDLY_URL.replace(/\//g, "\\/")}[^"]*"`));
    expect(html).toMatch(/mailto:hello@competepulse\.com/);
  });

  it("ships no inline executable script, so script-src can stay at 'self'", () => {
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    for (const [, attrs, body] of scripts) {
      if (/type="application\/ld\+json"/.test(attrs)) continue;
      expect(attrs, `inline <script${attrs}> would need a CSP hash`).toMatch(/\ssrc="/);
      expect(body.trim()).toBe("");
    }
    expect(html).toMatch(/<script type="module" src="\/_astro\/[^"]+\.js">/);
  });

  it("emits canonical, Open Graph and JSON-LD on the configured origin", () => {
    expect(html).toContain(`rel="canonical" href="${SITE_URL}/"`);
    expect(html).toContain(`content="${SITE_URL}/og.png"`);
    expect(html).toContain('name="twitter:card" content="summary_large_image"');

    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(ld).not.toBeNull();
    const graph = JSON.parse(ld![1]) as { "@graph": Array<{ "@type": string }> };
    expect(graph["@graph"].map((node) => node["@type"])).toEqual([
      "Organization",
      "SoftwareApplication",
      "FAQPage",
    ]);
  });

  it("renders the FAQ answers that the FAQPage schema claims", () => {
    const text = textOf(html);
    expect(text).toMatch(/What counts as a material change\?/);
    expect(text).toMatch(/Do I need to install anything to try it\?/);
  });

  it("self-hosts the type and preloads the faces the headline needs", () => {
    for (const file of [
      "instrument-serif-400.woff2",
      "instrument-serif-400-italic.woff2",
      "ibm-plex-sans-400.woff2",
      "ibm-plex-sans-600.woff2",
      "ibm-plex-mono-400.woff2",
    ]) {
      expect(existsSync(join(outDir, "fonts", file)), `${file} missing from build`).toBe(true);
    }

    // Preloaded faces must be crossorigin or the browser fetches them twice.
    const preloads = [...html.matchAll(/<link rel="preload"[^>]*>/g)].map(([tag]) => tag);
    expect(preloads).toHaveLength(3);
    for (const tag of preloads) {
      expect(tag).toMatch(/as="font"/);
      expect(tag).toMatch(/crossorigin/);
    }
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  it("publishes robots, sitemap, icon and social card", () => {
    const robots = readFileSync(join(outDir, "robots.txt"), "utf8");
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap-index.xml`);
    for (const file of ["sitemap-index.xml", "favicon.svg", "og.png", "_headers"]) {
      expect(existsSync(join(outDir, file)), `${file} missing from build`).toBe(true);
    }
  });

  it("declares asset headers that permit the Calendly embed", () => {
    const headers = readFileSync(join(outDir, "_headers"), "utf8");
    expect(headers).toContain("script-src 'self' https://assets.calendly.com");
    expect(headers).toContain("frame-src https://calendly.com");
    expect(headers).toContain("font-src 'self'");
    expect(headers).toMatch(/\/fonts\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
  });

  it("stays inside its performance budget", () => {
    const htmlGzip = gzipSync(readFileSync(join(outDir, "index.html"))).length;
    expect(htmlGzip, "gzipped HTML (styles are inlined)").toBeLessThan(16_000);

    // Budget the marketing page only — /interview ships its own drill script and
    // must not inflate the outbound landing's JS ceiling.
    const assets = join(outDir, "_astro");
    const referenced = new Set(
      [...html.matchAll(/\/_astro\/([^"']+\.js)/g)].map((match) => match[1]!),
    );
    const js = [...referenced].reduce((total, file) => {
      const path = join(assets, file);
      return total + (existsSync(path) ? statSync(path).size : 0);
    }, 0);
    expect(js, "client JavaScript on index").toBeLessThan(4_000);
  });

  it("ships a noindex interview brief with reveal drills", () => {
    const nested = join(outDir, "interview", "index.html");
    const flat = join(outDir, "interview.html");
    const pagePath = existsSync(flat) ? flat : nested;
    expect(existsSync(pagePath), "interview page missing from build").toBe(true);
    const page = readFileSync(pagePath, "utf8");
    expect(page).toMatch(/noindex/);
    expect(textOf(page)).toMatch(/Explain CompetePulse like you built it/);
    expect(textOf(page)).toMatch(/Interview drill/);
  });
});

describe("built page (no booking link configured)", () => {
  it("degrades the call-to-action to email instead of a dead button", () => {
    const outDir = build("unconfigured", { PUBLIC_CALENDLY_URL: "" });
    const html = readFileSync(join(outDir, "index.html"), "utf8");

    expect(html).not.toContain("data-calendly-url");
    expect(html).not.toContain("calendly.com");
    const ctas = [...html.matchAll(/<a[^>]*data-cta-placement="[^"]+"[^>]*>/g)];
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    for (const [tag] of ctas) expect(tag).toMatch(/href="mailto:/);
  });
});

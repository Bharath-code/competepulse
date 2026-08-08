/**
 * Lazily mounts the Calendly inline widget.
 *
 * Calendly's widget bundle is ~100kB of JS + CSS and an iframe. Loading it on
 * first paint would dominate the page weight for a visitor who never scrolls,
 * so it is fetched only when the booking section is close to the viewport or the
 * visitor actually clicks a call-to-action.
 *
 * The static link inside the panel is the source of truth: it works with
 * JavaScript disabled, and it stays on screen until Calendly confirms it has
 * rendered. If the script is blocked, times out, or errors, the visitor is left
 * with a working booking link instead of an empty box.
 */

const WIDGET_JS = "https://assets.calendly.com/assets/external/widget.js";
const WIDGET_CSS = "https://assets.calendly.com/assets/external/widget.css";
const RENDER_TIMEOUT_MS = 8000;
const PRELOAD_MARGIN = "500px";

type EmbedState = "idle" | "loading" | "ready" | "failed";

interface CalendlyGlobal {
  initInlineWidget(options: { url: string; parentElement: HTMLElement }): void;
}

function calendlyGlobal(): CalendlyGlobal | undefined {
  return (globalThis as { Calendly?: CalendlyGlobal }).Calendly;
}

function preconnect(href: string): void {
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = href;
  link.crossOrigin = "anonymous";
  document.head.append(link);
}

function loadOnce(tag: "link" | "script", href: string): Promise<void> {
  const selector = tag === "link" ? `link[href="${href}"]` : `script[src="${href}"]`;
  const existing = document.head.querySelector(selector);
  if (existing) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const el = document.createElement(tag);
    el.addEventListener("load", () => resolve(), { once: true });
    el.addEventListener("error", () => reject(new Error(`Failed to load ${href}`)), { once: true });
    if (el instanceof HTMLLinkElement) {
      el.rel = "stylesheet";
      el.href = href;
    } else if (el instanceof HTMLScriptElement) {
      el.src = href;
      el.async = true;
    }
    document.head.append(el);
  });
}

function setUp(panel: HTMLElement): void {
  const url = panel.dataset.calendlyUrl;
  const target = panel.querySelector<HTMLElement>("[data-calendly-target]");
  if (!url || !target) return;

  const setState = (state: EmbedState) => {
    panel.dataset.calendlyState = state;
  };

  setState("idle");

  let started = false;
  let renderTimer: number | undefined;

  /** Calendly posts a message once the event type is actually painted. */
  const onCalendlyMessage = (event: MessageEvent) => {
    const data = event.data as { event?: unknown } | null;
    if (typeof data?.event !== "string" || !data.event.startsWith("calendly.")) return;
    window.clearTimeout(renderTimer);
    window.removeEventListener("message", onCalendlyMessage);
    setState("ready");
  };

  const start = () => {
    if (started) return;
    started = true;
    setState("loading");

    preconnect("https://calendly.com");
    preconnect("https://assets.calendly.com");

    window.addEventListener("message", onCalendlyMessage);
    renderTimer = window.setTimeout(() => {
      window.removeEventListener("message", onCalendlyMessage);
      if (panel.dataset.calendlyState !== "ready") setState("failed");
    }, RENDER_TIMEOUT_MS);

    void Promise.all([loadOnce("link", WIDGET_CSS), loadOnce("script", WIDGET_JS)])
      .then(() => {
        const calendly = calendlyGlobal();
        if (!calendly) throw new Error("Calendly global missing after load");
        calendly.initInlineWidget({ url, parentElement: target });
      })
      .catch(() => {
        window.clearTimeout(renderTimer);
        window.removeEventListener("message", onCalendlyMessage);
        setState("failed");
      });
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        start();
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(panel);
  } else {
    start();
  }

  // A visitor clicking a CTA is about to need the widget — don't wait for scroll.
  for (const cta of document.querySelectorAll<HTMLAnchorElement>("[data-cta-placement]")) {
    if (cta.getAttribute("href") === "#book") cta.addEventListener("pointerdown", start);
  }

  if (window.location.hash === "#book") start();
}

const panel = document.querySelector<HTMLElement>("[data-calendly-url]");
if (panel) setUp(panel);

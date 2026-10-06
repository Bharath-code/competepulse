/**
 * Landing entry. Stays tiny: three.js and GSAP load only when they'll be seen,
 * never under reduced motion or Save-Data, so the static page carries LCP.
 */
const calm =
  matchMedia("(prefers-reduced-motion: reduce)").matches ||
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

const idle = (fn: () => void) =>
  "requestIdleCallback" in window
    ? requestIdleCallback(fn, { timeout: 2500 })
    : setTimeout(fn, 1200);

if (!calm) {
  const field = document.querySelector<HTMLElement>("[data-pulse-field]");
  if (field && matchMedia("(min-width: 60rem)").matches) {
    // No WebGL: WebGLRenderer throws, the catch keeps the static poster.
    const boot = () =>
      idle(() => import("./pulse-field").then((m) => m.mount(field)).catch(() => {}));
    if (document.readyState === "complete") boot();
    else addEventListener("load", boot, { once: true });
  }

  const story = document.querySelector<HTMLElement>("[data-story]");
  if (story) {
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        import("./story").then((m) => m.init(story)).catch(() => {});
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(story);
  }
}

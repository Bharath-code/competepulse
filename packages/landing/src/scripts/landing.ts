/**
 * Landing entry: stays tiny. GSAP loads only when a moving scene is about to be
 * seen (the desktop hero at idle, or the product steps nearing the viewport),
 * never under reduced motion or Save-Data. Until then, and without JS, every
 * scene shows its finished state.
 */
const calm =
  matchMedia("(prefers-reduced-motion: reduce)").matches ||
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

if (!calm) {
  let started = false;
  const run = () => {
    if (started) return;
    started = true;
    import("./motion").then((m) => m.init()).catch(() => {});
  };

  if (matchMedia("(min-width: 64rem)").matches) {
    const idle = () =>
      "requestIdleCallback" in window
        ? requestIdleCallback(run, { timeout: 2000 })
        : setTimeout(run, 600);
    if (document.readyState === "complete") idle();
    else addEventListener("load", idle, { once: true });
  }

  const near = document.querySelector("[data-steps]");
  if (near) {
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        run();
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(near);
  }
}

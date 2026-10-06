import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Play = (fig: HTMLElement) => gsap.core.Timeline;

/** One small timeline per picture: each shows the thing that just changed. */
const plays: Record<string, Play> = {
  change: (f) =>
    gsap
      .timeline()
      .fromTo(
        f.querySelector("[data-strike]"),
        { scaleX: 0 },
        { scaleX: 1, duration: 0.45, ease: "power2.out" },
      )
      .fromTo(
        f.querySelector("[data-new]"),
        { yPercent: 110 },
        { yPercent: 0, duration: 0.6, ease: "expo.out" },
        "-=0.1",
      )
      .fromTo(
        f.querySelectorAll("[data-diff]"),
        { autoAlpha: 0, x: -8 },
        { autoAlpha: 1, x: 0, stagger: 0.12, duration: 0.35 },
        "-=0.2",
      ),
  deals: (f) =>
    gsap
      .timeline()
      .fromTo(
        f.querySelectorAll('[data-row="miss"]'),
        { opacity: 1 },
        { opacity: 0.45, duration: 0.4 },
      )
      .fromTo(
        f.querySelectorAll('[data-row="hit"]'),
        { x: 0 },
        { x: 6, duration: 0.2, yoyo: true, repeat: 1, stagger: 0.12 },
        "<",
      )
      .fromTo(
        f.querySelectorAll('[data-row="hit"] .chip'),
        { scale: 0.6 },
        { scale: 1, duration: 0.5, ease: "back.out(3)", stagger: 0.15 },
        "<0.1",
      ),
  dm: (f) =>
    gsap
      .timeline()
      .fromTo(
        f.querySelectorAll("[data-dm]"),
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, stagger: 0.16, duration: 0.4, ease: "power2.out" },
      )
      .fromTo(
        f.querySelector("[data-approved]"),
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.3 },
        "+=0.35",
      ),
  result: (f) => {
    const tl = gsap.timeline();
    f.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
      const n = { v: 0 };
      tl.to(
        n,
        {
          v: Number(el.dataset.count),
          duration: 0.9,
          ease: "power1.out",
          onUpdate: () => (el.textContent = String(Math.round(n.v))),
        },
        0,
      );
    });
    return tl.fromTo(
      f.querySelectorAll("[data-seg]"),
      { scaleX: 0 },
      { scaleX: 1, duration: 0.6, stagger: 0.1, ease: "power2.out" },
      0.2,
    );
  },
};

export function init(section: HTMLElement): void {
  const beats = [...section.querySelectorAll<HTMLElement>("[data-beat]")];
  const figures = beats.map((b) => b.querySelector<HTMLElement>("[data-figure]")!);
  const stage = section.querySelector<HTMLElement>("[data-stage]")!;
  const ticks = [...section.querySelectorAll<HTMLElement>("[data-tick]")];
  const mm = gsap.matchMedia();

  mm.add("(min-width: 56rem)", () => {
    section.classList.add("is-staged");
    figures.forEach((f) => stage.appendChild(f));
    gsap.set(figures, { autoAlpha: 0, y: 30 });
    let current = -1;

    const show = (i: number) => {
      if (i === current) return;
      const dir = i > current ? 1 : -1;
      figures.forEach((f, j) => {
        if (j !== i)
          gsap.to(f, {
            autoAlpha: 0,
            y: -30 * dir,
            scale: 0.97,
            duration: 0.4,
            ease: "power2.in",
            overwrite: true,
          });
      });
      gsap.fromTo(
        figures[i]!,
        { autoAlpha: 0, y: 30 * dir, scale: 0.97 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          ease: "expo.out",
          delay: 0.12,
          overwrite: true,
        },
      );
      plays[figures[i]!.dataset.figure!]?.(figures[i]!).delay(0.35);
      beats.forEach((b, j) => b.classList.toggle("is-active", j === i));
      ticks.forEach((t, j) => t.classList.toggle("is-on", j <= i));
      current = i;
    };

    beats.forEach((b, i) =>
      ScrollTrigger.create({
        trigger: b,
        start: "top 55%",
        end: "bottom 55%",
        onToggle: (st) => st.isActive && show(i),
      }),
    );
    show(0);

    return () => {
      section.classList.remove("is-staged");
      beats.forEach((b, i) => b.appendChild(figures[i]!));
      gsap.set(figures, { clearProps: "all" });
    };
  });

  mm.add("(max-width: 55.99rem)", () => {
    figures.forEach((f) =>
      ScrollTrigger.create({
        trigger: f,
        start: "top 75%",
        once: true,
        onEnter: () => plays[f.dataset.figure!]?.(f),
      }),
    );
  });
}

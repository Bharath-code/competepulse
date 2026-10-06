import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Kinetics "Toast Overshoot": cubic-bezier(0.18, 1.25, 0.4, 1). */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}
const toast = bezier(0.18, 1.25, 0.4, 1);

/** Kinetics "Scramble Reveal": random glyphs settle left to right. */
function scramble(el: HTMLElement, final: string, duration: number) {
  const glyphs = "0123456789";
  const state = { p: 0 };
  return gsap.to(state, {
    p: 1,
    duration,
    ease: "none",
    onUpdate: () => {
      const settled = Math.floor(state.p * final.length);
      el.textContent = [...final]
        .map((ch, i) => (i < settled || ch === "$" ? ch : glyphs[(Math.random() * 10) | 0]))
        .join("");
    },
    onComplete: () => {
      el.textContent = final;
    },
  });
}

function drawable(path: SVGPathElement | SVGGeometryElement) {
  const length = path.getTotalLength();
  gsap.set(path, { strokeDasharray: length, strokeDashoffset: 0 });
  return length;
}

function hero() {
  const root = document.querySelector<HTMLElement>("[data-scene]");
  if (!root || !matchMedia("(min-width: 64rem)").matches) return;
  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const after = $<HTMLElement>("[data-after]");
  const finalPrice = after.textContent ?? "";
  const strike = $("[data-strike]");
  const badge = $("[data-badge]");
  const dm = $("[data-dm]");
  const tick = $<SVGPathElement>("[data-tick]");
  const counter = $<HTMLElement>("[data-counter]");
  const rows = [...root.querySelectorAll<HTMLElement>('[data-row="hit"]')];
  const wires = [...root.querySelectorAll<SVGPathElement>("[data-wire]")];
  const wireLen = wires.map(drawable);
  const tickLen = drawable(tick);
  const count = { v: Number(counter.dataset.counter) };
  const showCount = () => (counter.textContent = String(Math.round(count.v)));

  // The page already shows the finished frame, so each loop starts by rewinding it.
  const tl = gsap.timeline({ repeat: -1, paused: true, defaults: { ease: "power2.out" } });
  tl.to([dm, badge], { autoAlpha: 0, duration: 0.4 })
    .to(after, { autoAlpha: 0, duration: 0.3 }, "<")
    .to(strike, { scaleX: 0, duration: 0.3 }, "<")
    .to(wires, { strokeDashoffset: (i: number) => wireLen[i]!, duration: 0.3 }, "<")
    .set(tick, { strokeDashoffset: tickLen })
    .to(count, { v: 0, duration: 0.3, onUpdate: showCount }, "<")
    .call(() => rows.forEach((r) => r.classList.remove("is-hit")))
    .to(strike, { scaleX: 1, duration: 0.45 }, "+=0.5")
    .set(after, { autoAlpha: 1 })
    .add(scramble(after, finalPrice, 0.7), "<")
    .fromTo(
      badge,
      { autoAlpha: 0, scale: 0.6 },
      { autoAlpha: 1, scale: 1, duration: 0.45, ease: "back.out(3)" },
    )
    .to(wires, { strokeDashoffset: 0, duration: 0.7, ease: "power1.inOut" })
    .call(() => rows[0]?.classList.add("is-hit"))
    .call(() => rows[1]?.classList.add("is-hit"), [], "+=0.35")
    .fromTo(
      dm,
      { autoAlpha: 0, y: -26, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: toast },
      "+=0.45",
    )
    .to(tick, { strokeDashoffset: 0, duration: 0.4 }, "+=0.35")
    .to(count, { v: Number(counter.dataset.counter), duration: 0.6, onUpdate: showCount }, "<")
    .to({}, { duration: 3.2 });

  ScrollTrigger.create({
    trigger: root,
    start: "top bottom",
    end: "bottom top",
    onToggle: (st) => (st.isActive ? tl.play() : tl.pause()),
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? tl.pause() : tl.play()));
}

function problem() {
  const root = document.querySelector<HTMLElement>("[data-problem]");
  if (!root) return;
  const dots = root.querySelectorAll("[data-dot]");
  const fix = root.querySelector("[data-fix]");
  const mm = gsap.matchMedia();
  mm.add("(min-width: 56rem)", () => {
    gsap
      .timeline({
        scrollTrigger: {
          trigger: root.querySelector(".week"),
          start: "top 80%",
          end: "bottom 60%",
          scrub: 0.6,
        },
      })
      .fromTo(
        root.querySelector("[data-track]"),
        { scaleX: 0 },
        { scaleX: 1, ease: "none", duration: 4 },
      )
      .fromTo(dots, { scale: 0 }, { scale: 1, stagger: 1, duration: 0.4, ease: "back.out(3)" }, 0)
      .fromTo(fix, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1 }, 3.4);
  });
}

function steps() {
  const root = document.querySelector<HTMLElement>("[data-steps]");
  if (!root) return;
  const inputs = [...root.querySelectorAll<HTMLInputElement>('input[name="step"]')];
  const labelOf = (i: HTMLInputElement) => root.querySelector<HTMLElement>(`label[for="${i.id}"]`)!;
  const reveal = (input: HTMLInputElement) => {
    const panel = root.querySelector(`[data-panel="${input.value}"] .panel__visual`);
    if (panel)
      gsap.fromTo(
        panel,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" },
      );
  };
  inputs.forEach((i) => i.addEventListener("change", () => reveal(i)));

  let bar: gsap.core.Tween | null = null;
  let stopped = false;
  const advance = () => {
    if (stopped) return;
    const current = inputs.findIndex((i) => i.checked);
    const label = labelOf(inputs[current]!);
    bar = gsap.fromTo(
      label,
      { "--p": 0 },
      {
        "--p": 1,
        duration: 5.5,
        ease: "none",
        onComplete: () => {
          gsap.set(label, { "--p": 0 });
          const next = inputs[(current + 1) % inputs.length]!;
          next.checked = true;
          reveal(next);
          advance();
        },
      },
    );
  };
  const stop = () => {
    stopped = true;
    bar?.kill();
    inputs.forEach((i) => gsap.set(labelOf(i), { "--p": 0 }));
  };
  ["pointerdown", "keydown", "focusin"].forEach((e) =>
    root.addEventListener(e, stop, { once: true }),
  );

  ScrollTrigger.create({
    trigger: root,
    start: "top 70%",
    end: "bottom 30%",
    onToggle: (st) => {
      if (stopped) return;
      if (st.isActive && !bar?.isActive()) advance();
      else if (!st.isActive) bar?.pause();
    },
  });
}

export function init(): void {
  hero();
  problem();
  steps();
}

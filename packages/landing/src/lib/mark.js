/**
 * The CompetePulse mark: an off-centre "pulse" ring that forms a C, thick where
 * the wave starts and thinning toward its opening, with one dot in the gap —
 * the rival's move travelling toward the one deal it reaches.
 *
 * Construction (24 grid): outer circle c(12,12) r9.25, inner circle c(13.6,12)
 * r6.1, opening cut by radial lines at ±36° from the outer centre, dot c(20.45,12)
 * r2.1; whole mark shifted −0.6 for optical centring. The 16 grid is a separate
 * cut with a thicker tail (≥1.85px) so the favicon never goes soft.
 *
 * Plain JS so Astro components and the Node icon/OG scripts share one source.
 */

/** Optimised for ≥20px. */
export const MARK_24 = {
  viewBox: "0 0 24 24",
  ring: "M18.88 6.56A9.25 9.25 0 1 0 18.88 17.44L17.32 16.3A6.1 6.1 0 1 1 17.32 7.7Z",
  dot: { cx: 19.85, cy: 12, r: 2.1 },
};

/** Optimised for 16px (favicon). */
export const MARK_16 = {
  viewBox: "0 0 16 16",
  ring: "M12.66 3.76A6.6 6.6 0 1 0 12.66 12.24L11.22 11.04A4.15 4.15 0 1 1 11.22 4.96Z",
  dot: { cx: 13.35, cy: 8, r: 1.6 },
};

export const MARK_COLORS = {
  indigo: "#1b1938",
  violet: "#c9b4fa",
  /** Dot on light grounds, where the pale violet would vanish. */
  violetMid: "#7b5cf0",
  white: "#ffffff",
};

/** Standalone SVG string (for files and rasterising), mark drawn at `size` inside a `box`. */
export function markSvg({ mark = MARK_24, box, size, ring, dot, background, radius = 0 }) {
  const [, , vw] = mark.viewBox.split(" ").map(Number);
  const s = size / vw;
  const o = (box - size) / 2;
  const bg = background
    ? `<rect width="${box}" height="${box}" rx="${radius}" fill="${background}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}">${bg}<g transform="translate(${o} ${o}) scale(${s})"><path d="${mark.ring}" fill="${ring}"/><circle cx="${mark.dot.cx}" cy="${mark.dot.cy}" r="${mark.dot.r}" fill="${dot}"/></g></svg>`;
}

/**
 * Renders `public/og.png` (1200×630): mark, wordmark and headline on the indigo dusk ground (DESIGN.md).
 *
 * Link previews are the first thing a cold prospect sees when the page is pasted
 * into LinkedIn, email or Slack, so the card has to be set in the same faces as
 * the page. It reads the committed woff2 files, decompresses them, and converts
 * every string to outlines, because the SVG rasteriser resolves fonts through
 * fontconfig and would otherwise silently substitute a system face.
 *
 * Run `pnpm --filter @competepulse/landing og` after editing the headline and
 * commit the result — the PNG is a checked-in artifact so the build needs no
 * image pipeline.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import sharp from "sharp";
import { decompress } from "wawoff2";
import { MARK_24, MARK_COLORS } from "../src/lib/mark.js";

const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = resolve(here, "../public/fonts");
const outFile = resolve(here, "../public/og.png");

const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 72;
const RIGHT = WIDTH - MARGIN;

const INDIGO = MARK_COLORS.indigo;
const INDIGO_DEEP = "#0e0c1f";
const VIOLET = MARK_COLORS.violet;
const WHITE = MARK_COLORS.white;
const MUTE = "#bcbac9";
const RULE = "#3f3a52";
const INK = WHITE;

/**
 * Decompression must stay sequential: wawoff2 shares one wasm heap, and running
 * these concurrently returns silently corrupted buffers.
 */
async function loadFonts(files) {
  const fonts = [];
  for (const file of files) {
    const sfnt = await decompress(await readFile(resolve(fontsDir, file)));
    fonts.push(opentype.parse(Uint8Array.from(sfnt).buffer));
  }
  return fonts;
}

const [display, sans] = await loadFonts([
  "bricolage-grotesque-700.woff2",
  "source-sans-3-400.woff2",
]);

/**
 * Serialise glyph outlines ourselves.
 *
 * opentype's `toPathData` rounds through a string concatenation that yields the
 * literal "NaN" for coordinates JavaScript prints in exponential form. Renderers
 * abort a path at the first parse error, so a single bad number silently swallows
 * the rest of the line — which is exactly how it failed here.
 */
function serialize(commands) {
  const n = (value) => {
    if (!Number.isFinite(value)) throw new Error(`non-finite path coordinate: ${value}`);
    return String(Math.round(value * 100) / 100);
  };

  return commands
    .map((c) => {
      switch (c.type) {
        case "M":
          return `M${n(c.x)} ${n(c.y)}`;
        case "L":
          return `L${n(c.x)} ${n(c.y)}`;
        case "C":
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        case "Q":
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        default:
          return "Z";
      }
    })
    .join("");
}

/**
 * Lay out one string as SVG path data. opentype's own `getPath` cannot letter-space,
 * and labels may be tracked, so glyphs are advanced by hand.
 */
function layout(font, text, size, tracking) {
  const scale = size / font.unitsPerEm;
  const glyphs = [...text].map((char) => font.charToGlyph(char));
  let pen = 0;
  const parts = [];

  glyphs.forEach((glyph, index) => {
    parts.push(serialize(glyph.getPath(pen, 0, size).commands));
    pen += glyph.advanceWidth * scale + tracking;
    const next = glyphs[index + 1];
    if (next) pen += font.getKerningValue(glyph, next) * scale;
  });

  return { d: parts.join(" "), width: pen - tracking };
}

function text(font, string, { x = MARGIN, y, size, tracking = 0, fill = INK, anchor = "start" }) {
  const { d, width } = layout(font, string, size, tracking);
  const dx = anchor === "end" ? x - width : x;
  return `<g transform="translate(${dx.toFixed(2)} ${y})" fill="${fill}"><path d="${d}"/></g>`;
}

function rule(y, { x = MARGIN, width = RIGHT - MARGIN, height = 1, fill = RULE } = {}) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
}

/** The mark at any size; `x`,`y` is its top-left. */
function mark(x, y, size, ring = WHITE, dot = VIOLET) {
  const k = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${k})"><path d="${MARK_24.ring}" fill="${ring}"/><circle cx="${MARK_24.dot.cx}" cy="${MARK_24.dot.cy}" r="${MARK_24.dot.r}" fill="${dot}"/></g>`;
}

const body = [
  `<defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INDIGO}"/><stop offset="1" stop-color="${INDIGO_DEEP}"/></linearGradient>
    <radialGradient id="sky" cx="0.82" cy="0.32" r="0.55"><stop offset="0" stop-color="${VIOLET}" stop-opacity="0.34"/><stop offset="1" stop-color="${VIOLET}" stop-opacity="0"/></radialGradient>
  </defs>`,
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>`,
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#sky)"/>`,

  // The mark as the card's image: large, cropped by the right edge.
  `<g opacity="0.95">${mark(760, 120, 420, "#2c2858", VIOLET)}</g>`,

  mark(MARGIN, 64, 44),
  text(display, "CompetePulse", { x: MARGIN + 56, y: 99, size: 34 }),

  text(display, "When a rival moves,", { y: 268, size: 64 }),
  text(display, "the rep on the deal", { y: 344, size: 64 }),
  text(display, "hears first.", { y: 420, size: 64 }),

  rule(472, { width: 560 }),
  text(sans, "Rival changes, matched to your open HubSpot deals,", {
    y: 516,
    size: 26,
    fill: MUTE,
  }),
  text(sans, "sent to the deal owner in Slack with proof.", { y: 550, size: 26, fill: MUTE }),

  `<rect x="${RIGHT - 300}" y="548" width="300" height="46" rx="23" fill="${VIOLET}"/>`,
  text(sans, "Book a 25-min call", { x: RIGHT - 150 - 92, y: 579, size: 22, fill: INDIGO }),
].join("\n  ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${body}
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile(outFile, png);

console.log(`og.png written: ${outFile} (${(png.length / 1024).toFixed(1)} kB)`);

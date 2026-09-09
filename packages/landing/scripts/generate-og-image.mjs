/**
 * Renders `public/og.png` (1200×630) — brand + JTBD headline on the cool-LED ground.
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

const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = resolve(here, "../public/fonts");
const outFile = resolve(here, "../public/og.png");

const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 72;
const RIGHT = WIDTH - MARGIN;

const GROUND = "#f0f6f9";
const INK = "#121c26";
const INK_3 = "#636a71";
const SIGNAL = "#cb2d26";
const RULE = "#cbd2d6";

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

const [display, sans, mono] = await loadFonts([
  "bricolage-grotesque-700.woff2",
  "source-sans-3-400.woff2",
  "jetbrains-mono-400.woff2",
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
 * and the mono labels on this card are heavily tracked, so glyphs are advanced by hand.
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

const body = [
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="${GROUND}"/>`,
  `<rect width="${WIDTH}" height="10" fill="${SIGNAL}"/>`,

  text(mono, "NOW TAKING 3 DESIGN PARTNERS", { y: 78, size: 18, tracking: 2.2, fill: INK_3 }),
  text(mono, "WEEKDAY MORNINGS", {
    x: RIGHT,
    y: 78,
    size: 18,
    tracking: 2.2,
    fill: INK_3,
    anchor: "end",
  }),
  rule(98),

  text(display, "CompetePulse", { y: 168, size: 58 }),
  rule(196, { height: 2, fill: INK }),

  text(display, "Every morning in Slack:", { y: 300, size: 52 }),
  text(display, "what materially changed", { y: 372, size: 52, fill: SIGNAL }),
  text(display, "on your competitors — with links.", { y: 444, size: 52 }),

  rule(486),
  text(sans, "Pricing and changelog watches, scored for materiality, cited in every line.", {
    y: 530,
    size: 24,
    fill: INK_3,
  }),

  `<rect x="${MARGIN}" y="562" width="220" height="40" rx="4" fill="${SIGNAL}"/>`,
  text(mono, "BOOK A 15-MIN CALL", { x: MARGIN + 18, y: 588, size: 18, tracking: 1.4, fill: GROUND }),
  text(mono, "NO KLUE BILL. NO VISUALPING NOISE.", {
    x: RIGHT,
    y: 588,
    size: 17,
    tracking: 1.2,
    fill: INK_3,
    anchor: "end",
  }),
].join("\n  ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${body}
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile(outFile, png);

console.log(`og.png written: ${outFile} (${(png.length / 1024).toFixed(1)} kB)`);

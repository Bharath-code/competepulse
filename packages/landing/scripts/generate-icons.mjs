/**
 * Writes the favicon and app icons from the one mark definition in
 * `src/lib/mark.js`. Run `pnpm --filter @competepulse/landing icons` after
 * changing the mark and commit the output.
 */
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { MARK_16, MARK_24, MARK_COLORS, markSvg } from "../src/lib/mark.js";

const out = (file) => resolve(dirname(fileURLToPath(import.meta.url)), "../public", file);
const { indigo, violet, white } = MARK_COLORS;

// Browser tab: the 16-grid cut on an indigo tile, so it reads on light and dark tab bars.
const favicon = markSvg({
  mark: MARK_16,
  box: 32,
  size: 23,
  ring: white,
  dot: violet,
  background: indigo,
  radius: 7,
});
await writeFile(out("favicon.svg"), `${favicon}\n`);

// iOS masks its own corners, so the touch icon is a full square.
const touch = markSvg({
  mark: MARK_24,
  box: 180,
  size: 116,
  ring: white,
  dot: violet,
  background: indigo,
});
await writeFile(
  out("apple-touch-icon.png"),
  await sharp(Buffer.from(touch)).png({ compressionLevel: 9 }).toBuffer(),
);

// Fallback for clients that ignore SVG favicons.
const ico = markSvg({
  mark: MARK_16,
  box: 32,
  size: 23,
  ring: white,
  dot: violet,
  background: indigo,
  radius: 7,
});
await writeFile(
  out("favicon-32.png"),
  await sharp(Buffer.from(ico)).resize(32, 32).png().toBuffer(),
);

console.log("favicon.svg, favicon-32.png, apple-touch-icon.png written");

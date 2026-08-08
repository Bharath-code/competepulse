/**
 * Renders `public/og.png` (1200×630) from an inline SVG.
 *
 * Link previews are the first thing a cold prospect sees when the page is pasted
 * into LinkedIn, email or Slack, so the card carries the headline rather than a
 * bare logo. Run `pnpm --filter @competepulse/landing og` after editing the
 * headline and commit the result — the PNG is a checked-in artifact so the build
 * needs no image pipeline. Requires the Inter font to be installed locally.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(here, "../public/og.png");

const WIDTH = 1200;
const HEIGHT = 630;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="glowA" cx="12%" cy="0%" r="70%">
      <stop offset="0%" stop-color="#17334c" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#0b0f14" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowB" cx="100%" cy="4%" r="55%">
      <stop offset="0%" stop-color="#1d2b26" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0b0f14" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7cc3ff" />
      <stop offset="100%" stop-color="#3d9cf0" />
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0b0f14" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glowA)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glowB)" />

  <g transform="translate(80 82)">
    <path d="M0 22h18l13-36 19.5 72 14.5-50 9.5 14h34"
      fill="none" stroke="#3d9cf0" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    <text x="128" y="34" font-family="Inter, sans-serif" font-size="34" font-weight="600"
      letter-spacing="-0.5" fill="#e8eef4">CompetePulse</text>
  </g>

  <g font-family="Inter, sans-serif" font-size="66" font-weight="600" letter-spacing="-2.4">
    <text x="80" y="272" fill="#e8eef4">Every morning in Slack:</text>
    <text x="80" y="352" fill="url(#accent)">what materially changed</text>
    <text x="80" y="432" fill="url(#accent)">on your competitors<tspan fill="#e8eef4" dx="18">— with links.</tspan></text>
  </g>

  <text x="80" y="502" font-family="Inter, sans-serif" font-size="27" font-weight="400" fill="#9fb0c2">
    Pricing and changelog watches, scored for materiality, cited in every line.
  </text>

  <g transform="translate(80 548)">
    <rect width="386" height="56" rx="28" fill="url(#accent)" />
    <text x="193" y="36" text-anchor="middle" font-family="Inter, sans-serif" font-size="23"
      font-weight="600" fill="#04121f">Book a 15-min discovery call</text>
    <text x="418" y="36" font-family="Inter, sans-serif" font-size="21" fill="#7c8fa3">
      No Klue bill. No Visualping noise.
    </text>
  </g>
</svg>`;

await mkdir(dirname(outFile), { recursive: true });
const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile(outFile, png);

console.log(`og.png written: ${outFile} (${(png.length / 1024).toFixed(1)} kB)`);

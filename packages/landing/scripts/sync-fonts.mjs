/**
 * Copies the woff2 files we actually use out of the @fontsource packages into
 * `public/fonts/`, and writes a LICENSE note beside them.
 *
 * Self-hosting from a stable path (rather than importing the packages) buys
 * three things the build cannot otherwise have: a URL we can `<link rel=preload>`,
 * an immutable cache header in `public/_headers`, and a build that never touches
 * the network. Re-run `pnpm --filter @competepulse/landing fonts` after changing
 * the type stack and commit the result.
 */

import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../public/fonts");
const modules = resolve(here, "../node_modules/@fontsource");

/** [package, source file, destination] — latin subsets only. */
const FONTS = [
  [
    "bricolage-grotesque",
    "bricolage-grotesque-latin-700-normal.woff2",
    "bricolage-grotesque-700.woff2",
  ],
  ["source-sans-3", "source-sans-3-latin-400-normal.woff2", "source-sans-3-400.woff2"],
  ["source-sans-3", "source-sans-3-latin-600-normal.woff2", "source-sans-3-600.woff2"],
  ["jetbrains-mono", "jetbrains-mono-latin-400-normal.woff2", "jetbrains-mono-400.woff2"],
];

await mkdir(outDir, { recursive: true });

let total = 0;
for (const [pkg, from, to] of FONTS) {
  const src = resolve(modules, pkg, "files", from);
  const dest = resolve(outDir, to);
  await copyFile(src, dest);
  const { size } = await stat(dest);
  total += size;
  console.log(`${to.padEnd(34)} ${(size / 1024).toFixed(1)} kB`);
}

await writeFile(
  resolve(outDir, "LICENSE.md"),
  [
    "# Fonts",
    "",
    "All families are licensed under the SIL Open Font License 1.1 and are",
    "redistributed here as latin-subset woff2, copied from the @fontsource",
    "packages by `scripts/sync-fonts.mjs`.",
    "",
    "- **Bricolage Grotesque** — Copyright The Bricolage Grotesque Project Authors.",
    "  <https://github.com/evilliquid/Bricolage-Grotesque>",
    "- **Source Sans 3** — Copyright Adobe Systems Incorporated.",
    "  <https://github.com/adobe-fonts/source-sans>",
    "- **JetBrains Mono** — Copyright JetBrains.",
    "  <https://github.com/JetBrains/JetBrainsMono>",
    "",
    "Full licence text: <https://openfontlicense.org/>",
    "",
  ].join("\n"),
);

console.log(`\ntotal ${(total / 1024).toFixed(1)} kB across ${FONTS.length} files`);

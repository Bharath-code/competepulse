#!/usr/bin/env node
/**
 * E0-2 secrets hygiene: fail if git-tracked paths look like real secrets
 * or local env files that must never be committed.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FORBIDDEN_PATHS = [
  /^\.env$/,
  /^\.env\./, // .env.local, .env.production, …
  /(^|\/)\.dev\.vars$/,
  /(^|\/)credentials\.(json|txt)$/i,
  /(^|\/)id_rsa$/,
  /\.pem$/i,
];

// Allow the committed templates only.
const ALLOWLIST = new Set([".env.example", "packages/worker/.dev.vars.example"]);

const LEAK_PATTERNS = [
  /\bsk_live_[A-Za-z0-9]{10,}\b/,
  /\bsk_test_[A-Za-z0-9]{10,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----/,
  /\bFIRECRAWL_API_KEY\s*=\s*["']?[A-Za-z0-9_-]{16,}/,
  /\bSLACK_BOT_TOKEN\s*=\s*["']?xox/,
  /\bSTRIPE_SECRET_KEY\s*=\s*["']?sk_/,
];

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" });
  return out
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((p) => !ALLOWLIST.has(p));
}

function main() {
  const files = trackedFiles();
  const badPaths = files.filter((p) => FORBIDDEN_PATHS.some((re) => re.test(p)));
  if (badPaths.length > 0) {
    console.error("Secrets hygiene FAILED: forbidden paths are tracked:\n");
    for (const p of badPaths) console.error(`  - ${p}`);
    process.exit(1);
  }

  // Spot-check text-ish tracked files for common leak shapes (skip lockfiles/binaries).
  const textish = files.filter(
    (p) =>
      !p.endsWith("pnpm-lock.yaml") &&
      !p.includes("node_modules/") &&
      !/\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|zip|gz|tgz)$/i.test(p),
  );

  const leaks = [];
  for (const p of textish) {
    let content;
    try {
      content = readFileSync(p, "utf8");
    } catch {
      continue;
    }
    for (const re of LEAK_PATTERNS) {
      if (re.test(content)) {
        leaks.push(`${p} matches ${re}`);
        break;
      }
    }
  }

  if (leaks.length > 0) {
    console.error("Secrets hygiene FAILED: possible secret material in git:\n");
    for (const l of leaks) console.error(`  - ${l}`);
    process.exit(1);
  }

  console.log(`Secrets hygiene OK (${files.length} tracked paths checked).`);
}

main();

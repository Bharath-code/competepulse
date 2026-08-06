import { diffPricing } from "../materiality.js";
import { EVAL_CASES } from "./fixtures.js";

/**
 * Eval dry-run (roadmap E0-3 / E5-2): scores the materiality classifier against
 * the golden fixture set and enforces the Phase-1 precision gate.
 *
 * Precision here = of the cases we labelled "high", the fraction the classifier
 * also labelled "high" (i.e. we do not cry wolf about material changes).
 */
const PRECISION_GATE = 0.85;

function main(): void {
  let truePositive = 0;
  let falseNegative = 0;
  let correct = 0;

  console.log("CompetePulse materiality eval\n");
  for (const c of EVAL_CASES) {
    const actual = diffPricing(c.from, c.to, c.url).materiality;
    const ok = actual === c.expected;
    if (ok) correct += 1;
    if (c.expected === "high") {
      if (actual === "high") truePositive += 1;
      else falseNegative += 1;
    }
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${c.name} — expected ${c.expected}, got ${actual}`);
  }

  const highTotal = truePositive + falseNegative;
  const precision = highTotal === 0 ? 1 : truePositive / highTotal;
  const accuracy = correct / EVAL_CASES.length;

  console.log(
    `\nCases: ${EVAL_CASES.length}  Accuracy: ${(accuracy * 100).toFixed(1)}%  ` +
      `High-materiality recall: ${(precision * 100).toFixed(1)}% (gate ${(PRECISION_GATE * 100).toFixed(0)}%)`,
  );

  if (precision < PRECISION_GATE) {
    console.error(`\nEval FAILED: below ${(PRECISION_GATE * 100).toFixed(0)}% gate.`);
    process.exit(1);
  }
  console.log("\nEval passed.");
}

main();

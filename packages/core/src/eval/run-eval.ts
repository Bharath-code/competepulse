import { diffPricing } from "../materiality.js";
import { EVAL_CASES } from "./fixtures.js";

/**
 * Eval dry-run (roadmap E5-1 / E5-2): scores the materiality classifier against
 * the 20-page golden fixture set and enforces the Phase-1 precision gate.
 *
 * Precision = TP / (TP + FP) where a "positive" prediction is materiality=high.
 * Accuracy = exact label match across all cases.
 */
const PRECISION_GATE = 0.85;

function main(): void {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let correct = 0;

  console.log(`CompetePulse materiality eval (${EVAL_CASES.length} pages)\n`);
  for (const c of EVAL_CASES) {
    const actual = diffPricing(c.from, c.to, c.url).materiality;
    const ok = actual === c.expected;
    if (ok) correct += 1;

    if (actual === "high" && c.expected === "high") truePositive += 1;
    if (actual === "high" && c.expected !== "high") falsePositive += 1;
    if (actual !== "high" && c.expected === "high") falseNegative += 1;

    console.log(`  ${ok ? "PASS" : "FAIL"}  ${c.name} — expected ${c.expected}, got ${actual}`);
  }

  const precisionDenom = truePositive + falsePositive;
  const precision = precisionDenom === 0 ? 1 : truePositive / precisionDenom;
  const recallDenom = truePositive + falseNegative;
  const recall = recallDenom === 0 ? 1 : truePositive / recallDenom;
  const accuracy = correct / EVAL_CASES.length;

  console.log(
    `\nCases: ${EVAL_CASES.length}  Accuracy: ${(accuracy * 100).toFixed(1)}%  ` +
      `Precision: ${(precision * 100).toFixed(1)}%  Recall: ${(recall * 100).toFixed(1)}%  ` +
      `(gate ${(PRECISION_GATE * 100).toFixed(0)}% precision)`,
  );

  if (EVAL_CASES.length < 20) {
    console.error("\nEval FAILED: fewer than 20 fixtures (E5-1).");
    process.exit(1);
  }

  if (precision < PRECISION_GATE) {
    console.error(`\nEval FAILED: precision below ${(PRECISION_GATE * 100).toFixed(0)}% gate.`);
    process.exit(1);
  }
  console.log("\nEval passed.");
}

main();

import path from "node:path";
import { checkArchitecture } from "./architecture-checks.ts";

const srcDir = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, "..", "src"));
const violations = checkArchitecture(srcDir);

if (violations.length === 0) {
  console.log("Architecture checks passed");
} else {
  console.error(`Architecture checks failed: ${violations.length} violation(s).\n`);
  for (const violation of violations) {
    console.error(`FAIL [${violation.rule}] ${violation.message}`);
  }
  process.exitCode = 1;
}
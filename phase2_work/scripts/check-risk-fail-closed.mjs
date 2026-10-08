import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "src/server/platform/riskEngine.ts");
const content = fs.readFileSync(file, "utf8");
const failures = [];
if (content.includes("return assessRisk(extraSignals)")) failures.push("riskEngine must not return a low-risk decision when evidence loading fails");
if (!content.includes("Risk evaluation unavailable; safety evidence could not be loaded.")) failures.push("riskEngine must fail closed with an explicit availability error");
if (!content.includes("throw new Error('Risk evaluation unavailable; safety evidence could not be loaded.'")) failures.push("riskEngine must throw on provider/evidence failure");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("Risk fail-closed policy: PASS");

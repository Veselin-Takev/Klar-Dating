import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const legacy = path.join(root, "src/server/translation.ts");
if (fs.existsSync(legacy)) throw new Error("Retired legacy translation module must not exist");

const source = fs.readFileSync(path.join(root, "src/server/platform/translationEngine.ts"), "utf8");
if (!source.includes("sanitizePromptInput")) throw new Error("Translation engine must sanitize input before provider egress");
if (!source.includes("translateText as callTranslationService")) throw new Error("Translation engine must use the bounded translation service");
console.log("Legacy translation boundary: PASS");

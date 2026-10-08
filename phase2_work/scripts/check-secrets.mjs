import fs from 'fs';
import path from 'path';

const EXCLUDED_DIRS = ['google-cloud-sdk', 'node_modules', '.git', 'dist', 'build'];

function shouldSkip(filePath) {
  return EXCLUDED_DIRS.some(dir => filePath.split(path.sep).includes(dir));
}

function scanDir(dir, results = []) {
  if (shouldSkip(dir)) return results;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (shouldSkip(fullPath)) continue;

    if (entry.isDirectory()) {
      scanDir(fullPath, results);
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = scanDir(process.cwd());
let foundSecrets = false;

// Einfache Regex-Prüfung auf typische Secret-Muster (z.B. API Keys, Private Keys)
const secretPatterns = [
  /AIza[0-9A-Za-z-_]{35}/,
  /-----BEGIN PRIVATE KEY-----/
];

for (const file of files) {
  // Eigene Skripte / Testdateien ggf. ausnehmen oder prüfen
  if (file.includes('check-secrets.mjs') || file.includes('firebase-applet-config.json')) continue;
  try {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        console.log(`Potential hard-coded secret found in: ${file}`);
        foundSecrets = true;
      }
    }
  } catch (e) {
    // Lesefehler ignorieren
  }
}

if (foundSecrets) {
  process.exit(1);
} else {
  console.log('Secret check passed successfully.');
  process.exit(0);
}

export interface EnvValidationResult {
  valid: boolean;
  missingVariables: string[];
  warnings: string[];
}

const REQUIRED_PRODUCTION_VARS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL",
  "KLAR_PUBLIC_URL",
];

const RECOMMENDED_VARS = [
  "METRICS_TOKEN",
  "PORT",
];

export function validateEnvironment(environment: string = process.env.NODE_ENV || "development"): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  const isProduction = environment === "production";

  if (isProduction) {
    for (const varName of REQUIRED_PRODUCTION_VARS) {
      if (!process.env[varName] || process.env[varName]?.trim() === "") {
        missing.push(varName);
      }
    }
  } else {
    // In Dev/Test prüfen wir nur auf Emulator-Präsenz oder Fallbacks
    if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_PROJECT_ID) {
      warnings.push("Weder FIRESTORE_EMULATOR_HOST noch FIREBASE_PROJECT_ID konfiguriert.");
    }
  }

  for (const rec of RECOMMENDED_VARS) {
    if (!process.env[rec]) {
      warnings.push(`Empfohlene Variable nicht gesetzt: ${rec}`);
    }
  }

  return {
    valid: missing.length === 0,
    missingVariables: missing,
    warnings,
  };
}

export function enforceEnvironmentGuard(): void {
  const result = validateEnvironment();
  
  if (result.warnings.length > 0) {
    result.warnings.forEach((w) => console.warn(`[CONFIG WARNING] ${w}`));
  }

  if (!result.valid) {
    console.error("==================================================");
    console.error("  SERVER-START ABGEBROCHEN: FEHLENDE SECRETS!     ");
    console.error("==================================================");
    result.missingVariables.forEach((v) => console.error(`  - FEHLT: ${v}`));
    console.error("==================================================");
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  } else {
    console.log("[CONFIG] Umgebungsvariablen und Secrets erfolgreich validiert.");
  }
}

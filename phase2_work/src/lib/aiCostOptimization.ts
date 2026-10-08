export type ModelTier = 'fast' | 'flagship';

export interface CostConfig {
  maxDailyCostEur: number;
  currentDayCostEur: number;
}

const COST_PER_1K_TOKENS = {
  fast: 0.0001,     // Kosteneffizientes Modell (z.B. Flash-Variante)
  flagship: 0.0025, // Hochpräzises Modell (z.B. Pro-Variante)
};

let globalConfig: CostConfig = {
  maxDailyCostEur: 15.0,
  currentDayCostEur: 0.0,
};

export function selectOptimalTier(taskComplexityScore: number): ModelTier {
  // Aufgaben unter Komplexitätsschwellenwert 0.6 nutzen das günstige Fast-Tier
  if (taskComplexityScore < 0.6) {
    return 'fast';
  }
  return 'flagship';
}

export function trackTokenCost(tier: ModelTier, tokenCount: number): number {
  const costPerToken = COST_PER_1K_TOKENS[tier] / 1000;
  const sessionCost = tokenCount * costPerToken;
  globalConfig.currentDayCostEur += sessionCost;
  return sessionCost;
}

export function checkBudgetSafety(): boolean {
  return globalConfig.currentDayCostEur < globalConfig.maxDailyCostEur;
}

export function resetDailyBudgetIfNeeded(): void {
  // Optionales Zurücksetzen für Test- oder Tageszyklen
  globalConfig.currentDayCostEur = 0.0;
}

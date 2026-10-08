export interface OptimizationRecommendation {
  id: string;
  category: 'FinOps' | 'Compliance' | 'Performance' | 'Resilience';
  title: string;
  priority: 'High' | 'Medium' | 'Low';
  estimatedSavingsEur: number;
  effort: 'Low' | 'Medium' | 'High';
  advantages: string[];
  disadvantages: string[];
  recommendation: string;
}

export interface EfficiencyReport {
  generatedAt: string;
  recipientEmail: string;
  totalEstimatedSavingsEur: number;
  recommendations: OptimizationRecommendation[];
}

let adminRecipientEmail: string = 'admin@klar-app.de';

export function setAdminReportEmail(email: string): void {
  adminRecipientEmail = email;
}

export function getAdminReportEmail(): string {
  return adminRecipientEmail;
}

export function generateWeeklyEfficiencyReport(): EfficiencyReport {
  const recommendations: OptimizationRecommendation[] = [
    {
      id: 'OPT-01',
      category: 'FinOps',
      title: 'Dynamic Model Tiering Routing',
      priority: 'High',
      estimatedSavingsEur: 450.0,
      effort: 'Low',
      advantages: ['Bis zu 60% geringere API-Kosten', 'Kein spürbarer Qualitätsverlust bei Standard-Prompts'],
      disadvantages: ['Einmalige Anpassung des Gateway-Routers erforderlich'],
      recommendation: 'Sofortige Aktivierung für alle Routine-Anfragen im Chat-Modul.'
    },
    {
      id: 'OPT-02',
      category: 'Compliance',
      title: 'Automated PII Masking & EU AI Act Audit',
      priority: 'High',
      estimatedSavingsEur: 1200.0,
      effort: 'Medium',
      advantages: ['Vollständige DSGVO- & EU-AI-Act-Konformität', 'Automatisierter Audit-Trail'],
      disadvantages: ['Minimale Latenzpuffer durch Regex-Filter'],
      recommendation: 'Verpflichtend beibehalten und in das zentrale Logging-Framework einbetten.'
    },
    {
      id: 'OPT-03',
      category: 'Performance',
      title: 'Aggressive CI/CD & Dependency Caching',
      priority: 'Medium',
      estimatedSavingsEur: 150.0,
      effort: 'Low',
      advantages: ['Reduzierung der GitHub Actions Runner-Minuten um 70%', 'Schnellere Time-to-Market'],
      disadvantages: ['Keine nennenswerten Nachteile'],
      recommendation: 'Bereits im CI/CD-Workflow implementiert; kontinuierlich überwachen.'
    }
  ];

  const totalEstimatedSavingsEur = recommendations.reduce((acc, curr) => acc + curr.estimatedSavingsEur, 0);

  return {
    generatedAt: new Date().toISOString(),
    recipientEmail: adminRecipientEmail,
    totalEstimatedSavingsEur,
    recommendations,
  };
}

export function sendWeeklyReportSimulation(): { success: boolean; report: EfficiencyReport } {
  const report = generateWeeklyEfficiencyReport();
  console.log(`[Governance Cron] Sending weekly efficiency report to ${report.recipientEmail}...`);
  console.log(`[Governance Report] Total estimated monthly savings: ${report.totalEstimatedSavingsEur} EUR`);
  
  return {
    success: true,
    report,
  };
}

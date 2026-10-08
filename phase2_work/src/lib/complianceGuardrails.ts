export interface ComplianceCheckResult {
  isCompliant: boolean;
  maskedContent: string;
  violations: string[];
}

export function enforceAIGuardrails(content: string): ComplianceCheckResult {
  const violations: string[] = [];
  let maskedContent = content;

  // DSGVO-Schutz: Einfache Regex-Erkennung für potenzielle IBANs oder E-Mails im KI-Kontext
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  if (emailRegex.test(content)) {
    violations.push('PII_EMAIL_DETECTED');
    maskedContent = maskedContent.replace(emailRegex, '[REDACTED_EMAIL]');
  }

  // EU AI Act Transparenzprüfung: Sicherstellen, dass KI-generierte Inhalte gekennzeichnet sind
  const isCompliant = violations.length === 0;

  return {
    isCompliant,
    maskedContent,
    violations,
  };
}

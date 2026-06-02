// ────────────────────────────────────────────────────────────────────────────
// Doctor Engine – confidence scoring
// ────────────────────────────────────────────────────────────────────────────

import { ConfidenceTier, DiagnosticFinding, InvestigationEvidence } from "./doctor-types.js";

/**
 * Converts a raw 0-100 confidence number to a human-readable tier.
 */
export function toConfidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 90) return "High";
  if (confidence >= 70) return "Medium";
  return "Low";
}

/**
 * Selects the single highest-confidence finding from a list.
 */
export function selectPrimaryFinding(findings: DiagnosticFinding[]): DiagnosticFinding | null {
  if (findings.length === 0) return null;
  return findings.reduce((best, current) => (current.confidence > best.confidence ? current : best));
}

/**
 * Applies boosters and penalties to an initial confidence estimate based on
 * how much corroborating evidence is present in the investigation model.
 */
export function calibrateConfidence(base: number, evidence: InvestigationEvidence): number {
  let score = base;

  // Booster: deployment log available and shows failed steps
  if (evidence.deploymentLog) {
    const failedSteps = evidence.deploymentLog.steps.filter((s) => s.status === "failed");
    score += failedSteps.length > 0 ? 5 : 2;
  }

  // Booster: job execution error message is populated
  if (evidence.jobExecution?.errorMessage) {
    score += 4;
  }

  // Booster: test failures present with stack traces
  if (evidence.testSuite) {
    const failedWithTrace = evidence.testSuite.results.filter(
      (r) => r.status === "failed" && r.stackTrace,
    );
    score += failedWithTrace.length > 0 ? 5 : 2;
  }

  // Booster: corroborating raw signals
  score += Math.min(evidence.rawSignals.length * 2, 10);

  // Booster: metadata components listed
  if ((evidence.storyMetadata?.metadataComponents.length ?? 0) > 0) {
    score += 3;
  }

  // Penalty: no deployment log at all – we're guessing
  if (!evidence.deploymentLog) {
    score -= 10;
  }

  // Penalty: no test results – can't corroborate
  if (!evidence.testSuite) {
    score -= 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Given multiple findings (potentially from different rules) deduplicate and
 * merge those of the same category, keeping the highest confidence score.
 */
export function mergeFindings(findings: DiagnosticFinding[]): DiagnosticFinding[] {
  const byCategory = new Map<string, DiagnosticFinding>();

  for (const finding of findings) {
    const existing = byCategory.get(finding.category);
    if (!existing || finding.confidence > existing.confidence) {
      byCategory.set(finding.category, {
        ...finding,
        affectedComponents: mergeUnique(
          existing?.affectedComponents ?? [],
          finding.affectedComponents,
        ),
        evidence: mergeUnique(existing?.evidence ?? [], finding.evidence),
        recommendedActions: mergeUnique(
          existing?.recommendedActions ?? [],
          finding.recommendedActions,
        ),
      });
    }
  }

  return [...byCategory.values()].sort((a, b) => b.confidence - a.confidence);
}

function mergeUnique(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

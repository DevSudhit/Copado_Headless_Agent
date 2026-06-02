// ────────────────────────────────────────────────────────────────────────────
// Doctor Engine – human-readable and JSON report renderer
// ────────────────────────────────────────────────────────────────────────────

import {
  CollectionSummary,
  ConfidenceTier,
  DiagnosticFinding,
  InvestigationReport,
  InvestigationReportJson,
} from "./doctor-types.js";

// ── ANSI colour helpers (gracefully degrade when colours are unsupported) ────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const GREY = "\x1b[90m";

function bold(s: string): string { return `${BOLD}${s}${RESET}`; }
function red(s: string): string { return `${RED}${s}${RESET}`; }
function green(s: string): string { return `${GREEN}${s}${RESET}`; }
function yellow(s: string): string { return `${YELLOW}${s}${RESET}`; }
function cyan(s: string): string { return `${CYAN}${s}${RESET}`; }
function grey(s: string): string { return `${GREY}${s}${RESET}`; }

// ── Tier colouring ────────────────────────────────────────────────────────────

function colourConfidence(confidence: number, tier: ConfidenceTier): string {
  const pct = `${confidence}%`;
  if (tier === "High") return green(pct);
  if (tier === "Medium") return yellow(pct);
  return red(pct);
}

// ── Collection summary block ──────────────────────────────────────────────────

function renderCollectionSummary(summary: CollectionSummary): string {
  const tick = green("✓");
  const cross = red("✗");
  const lines = [
    `  ${summary.deploymentLogs ? tick : cross}  Deployment Logs`,
    `  ${summary.jobExecution ? tick : cross}  Job Execution Details`,
    `  ${summary.storyDetails ? tick : cross}  User Story Details`,
    `  ${summary.promotionHistory ? tick : cross}  Promotion History`,
    `  ${summary.testResults ? tick : cross}  CRT Test Results`,
  ];
  return lines.join("\n");
}

// ── Single finding block ──────────────────────────────────────────────────────

function renderFinding(finding: DiagnosticFinding, tier: ConfidenceTier, index: number): string {
  const lines: string[] = [];
  const prefix = index === 0 ? bold("PRIMARY FINDING") : bold(`FINDING ${index + 1}`);

  lines.push(`\n${prefix}`);
  lines.push(`  ${bold("Failure Type:")}      ${finding.category.replace(/([A-Z])/g, " $1").trim()}`);
  lines.push(`  ${bold("Confidence:")}        ${colourConfidence(finding.confidence, tier)}`);
  lines.push(`  ${bold("Root Cause:")}        ${finding.rootCause}`);

  if (finding.affectedComponents.length > 0) {
    lines.push(`  ${bold("Affected Components:")}`);
    for (const c of finding.affectedComponents) {
      lines.push(`    • ${cyan(c)}`);
    }
  }

  if (finding.evidence.length > 0) {
    lines.push(`  ${bold("Evidence:")}`);
    for (const e of finding.evidence) {
      lines.push(`    ${grey("›")} ${e}`);
    }
  }

  lines.push(`  ${bold("Recommended Actions:")}`);
  for (const action of finding.recommendedActions) {
    lines.push(`    → ${action}`);
  }

  if (finding.suggestedCommand) {
    lines.push(`  ${bold("Suggested Command:")}  ${cyan(finding.suggestedCommand)}`);
  }

  return lines.join("\n");
}

// ── AI insights block ─────────────────────────────────────────────────────────

function renderAIInsights(insights: string): string {
  const lines = [
    `\n${bold(yellow("AI INSIGHTS"))} ${grey("(Copado Release Agent)")}`,
    ...insights.split(". ").filter(Boolean).map((s) => `  ${grey("›")} ${s.trim()}.`),
  ];
  return lines.join("\n");
}

// ── Status line ───────────────────────────────────────────────────────────────

function renderStatus(status: string): string {
  if (status === "passed") return green("PASSED");
  if (status === "failed") return red("FAILED");
  return yellow("INCONCLUSIVE");
}

// ── Banner ────────────────────────────────────────────────────────────────────

function renderBanner(report: InvestigationReport): string {
  const targetLabel = report.targetType.toUpperCase();
  return [
    "",
    bold(cyan("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")),
    bold(`  TRINETRA DOCTOR ENGINE  ·  ${targetLabel} INVESTIGATION`),
    bold(cyan("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")),
    "",
    `  ${bold("Investigating")} ${cyan(report.targetId)} ...`,
  ].join("\n");
}

// ── Main human-readable render ────────────────────────────────────────────────

export function renderHumanReport(report: InvestigationReport): string {
  const lines: string[] = [];

  lines.push(renderBanner(report));

  lines.push(`\n${bold("Collecting evidence:")}`);
  lines.push(renderCollectionSummary(report.collectionSummary));

  lines.push(
    `\n${bold("Investigation complete.")}  Status: ${renderStatus(report.status)}`,
  );

  if (report.allFindings.length === 0) {
    lines.push(`\n  ${green("No rule-based failure signatures detected.")} Deployment appears healthy.`);
    // AI insights may still contain analysis for inconclusive/unconfigured states
    if (report.aiInsights) {
      lines.push(renderAIInsights(report.aiInsights));
    }
    lines.push(
      `\n${bold(cyan("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))}`,
    );
    lines.push(grey(`  Investigated at: ${report.investigatedAt}`));
    lines.push("");
    return lines.join("\n");
  }

  lines.push(
    `\n  ${bold("Findings:")} ${report.allFindings.length} diagnostic finding${report.allFindings.length > 1 ? "s" : ""} identified.`,
  );

  // Primary finding at top
  if (report.primaryFinding) {
    lines.push(renderFinding(report.primaryFinding, report.confidenceTier, 0));
  }

  // Secondary findings (if any)
  const secondaryFindings = report.allFindings.filter((f) => f !== report.primaryFinding);
  if (secondaryFindings.length > 0) {
    lines.push(`\n${bold("Additional Findings:")}`);
    secondaryFindings.forEach((f, i) => {
      // Use per-finding confidence tier for secondary items
      const tier =
        f.confidence >= 90 ? "High" : f.confidence >= 70 ? "Medium" : ("Low" as const);
      lines.push(renderFinding(f, tier, i + 1));
    });
  }

  // AI insights (only when AI was invoked)
  if (report.aiInsights) {
    lines.push(renderAIInsights(report.aiInsights));
  }

  lines.push(
    `\n${bold(cyan("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))}`,
  );
  lines.push(grey(`  Investigated at: ${report.investigatedAt}`));
  lines.push("");

  return lines.join("\n");
}

// ── JSON serialiser ───────────────────────────────────────────────────────────

export function renderJsonReport(report: InvestigationReport): InvestigationReportJson {
  const primary = report.primaryFinding;

  return {
    status: report.status,
    failureType: primary?.category ?? "None",
    confidence: primary?.confidence ?? 0,
    confidenceTier: report.confidenceTier,
    rootCause: primary?.rootCause ?? "No root cause identified.",
    affectedComponents: primary?.affectedComponents ?? [],
    recommendedActions: primary?.recommendedActions ?? [],
    suggestedCommand: primary?.suggestedCommand,
    aiInsights: report.aiInsights,
    allFindings: report.allFindings.map((f) => ({
      category: f.category,
      confidence: f.confidence,
      rootCause: f.rootCause,
      affectedComponents: f.affectedComponents,
      evidence: f.evidence,
      recommendedActions: f.recommendedActions,
    })),
    investigatedAt: report.investigatedAt,
  };
}

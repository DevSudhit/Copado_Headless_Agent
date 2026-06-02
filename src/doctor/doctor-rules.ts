// ────────────────────────────────────────────────────────────────────────────
// Doctor Engine – pluggable diagnostic rules (Strategy Pattern)
// Each exported class implements DiagnosticRule and can be registered
// independently. New rules are added here without touching the engine.
// ────────────────────────────────────────────────────────────────────────────

import { calibrateConfidence } from "./doctor-confidence.js";
import { DiagnosticFinding, DiagnosticRule, InvestigationEvidence } from "./doctor-types.js";

// ── Keyword signatures used across rules ─────────────────────────────────────

const MISSING_DEPENDENCY_PATTERNS = [
  /missing\s+(field|customfield|permissionset|flow|class|trigger|object|layout|recordtype)/i,
  /does not exist/i,
  /not found in scope/i,
  /dependency.*not.*found/i,
  /cannot find.*component/i,
  /referenced.*does not exist/i,
  /field integrity exception/i,
  /invalid type/i,
  /unable to find/i,
];

const APEX_FAILURE_PATTERNS = [
  /system\.assertexception/i,
  /assert\s*failed/i,
  /nullpointerexception/i,
  /assertion.*failed/i,
  /test.*failed/i,
  /dml.*exception.*test/i,
  /no test data/i,
  /test.*coverage.*below/i,
  /insufficient.*test.*coverage/i,
];

const DRIFT_PATTERNS = [
  /metadata.*not.*exist.*target/i,
  /configuration.*mismatch/i,
  /not.*deployed.*target/i,
  /environment.*drift/i,
  /component.*missing.*org/i,
  /object.*missing.*destination/i,
];

const PIPELINE_CONFIG_PATTERNS = [
  /invalid.*promotion.*path/i,
  /missing.*approval/i,
  /policy.*violation/i,
  /no.*pipeline.*stage/i,
  /deployment.*blocked/i,
  /pipeline.*misconfigured/i,
];

// ── Helper ────────────────────────────────────────────────────────────────────

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function extractMatchingSignals(signals: string[], patterns: RegExp[]): string[] {
  return signals.filter((s) => matchesAny(s, patterns));
}

function extractMetadataRefs(signals: string[]): string[] {
  const refs = new Set<string>();
  const refPattern = /\b([A-Z][A-Za-z0-9_]+\.[A-Z][A-Za-z0-9_]+(?:__[a-z]+)?)\b/g;
  for (const s of signals) {
    for (const match of s.matchAll(refPattern)) {
      refs.add(match[1]);
    }
  }
  return [...refs];
}

function allSignals(evidence: InvestigationEvidence): string[] {
  const signals: string[] = [...evidence.rawSignals];

  if (evidence.deploymentLog) {
    signals.push(...evidence.deploymentLog.rawLogs);
    for (const step of evidence.deploymentLog.steps) {
      if (step.message) signals.push(step.message);
    }
  }

  if (evidence.jobExecution?.errorMessage) {
    signals.push(evidence.jobExecution.errorMessage);
    for (const step of evidence.jobExecution.steps) {
      if (step.errorMessage) signals.push(step.errorMessage);
    }
  }

  if (evidence.testSuite) {
    for (const r of evidence.testSuite.results) {
      if (r.errorMessage) signals.push(r.errorMessage);
      if (r.stackTrace) signals.push(r.stackTrace);
    }
  }

  return signals;
}

// ── Rule 1: Metadata Dependency Failure ──────────────────────────────────────

export class MetadataDependencyRule implements DiagnosticRule {
  readonly name = "MetadataDependencyRule";
  readonly category = "MetadataDependencyFailure" as const;

  evaluate(evidence: InvestigationEvidence): DiagnosticFinding | null {
    const signals = allSignals(evidence);
    const matching = extractMatchingSignals(signals, MISSING_DEPENDENCY_PATTERNS);

    if (matching.length === 0) return null;

    const metadataRefs = extractMetadataRefs(signals);
    const deployedComponents = evidence.storyMetadata?.metadataComponents ?? [];
    const missingRefs = metadataRefs.filter((ref) => !deployedComponents.includes(ref));

    const affectedComponents =
      missingRefs.length > 0 ? missingRefs : metadataRefs.slice(0, 3);

    const baseConfidence = 60 + Math.min(matching.length * 10, 30);
    const confidence = calibrateConfidence(baseConfidence, evidence);

    const storyId = evidence.storyMetadata?.storyId;
    const primaryMissing = affectedComponents[0];

    return {
      category: this.category,
      confidence,
      rootCause: primaryMissing
        ? `Missing metadata dependency: ${primaryMissing} is referenced but not present in deployment scope.`
        : "One or more metadata components required by this deployment are missing from scope.",
      affectedComponents,
      evidence: matching.slice(0, 4),
      recommendedActions: [
        ...(primaryMissing
          ? [`Add ${primaryMissing} to the deployment package and rerun validation.`]
          : ["Review deployment scope for missing metadata components."]),
        "Verify all dependent metadata components are included in the user story.",
        "Run a full dependency analysis before re-deploying.",
      ],
      suggestedCommand: storyId
        ? `trinetra repair dependencies --story ${storyId}`
        : "trinetra repair dependencies --story <story-id>",
    };
  }
}

// ── Rule 2: Apex Test Failure ─────────────────────────────────────────────────

export class ApexTestFailureRule implements DiagnosticRule {
  readonly name = "ApexTestFailureRule";
  readonly category = "ApexTestFailure" as const;

  evaluate(evidence: InvestigationEvidence): DiagnosticFinding | null {
    const failedTests =
      evidence.testSuite?.results.filter((r) => r.status === "failed") ?? [];
    const signals = allSignals(evidence);
    const matchingSignals = extractMatchingSignals(signals, APEX_FAILURE_PATTERNS);

    if (failedTests.length === 0 && matchingSignals.length === 0) return null;

    const affectedTests = failedTests.map((t) => `${t.testClass}.${t.methodName}`);

    // Surface coverage issue if it exists
    const coverageFailed = signals.some((s) => /coverage/i.test(s));
    const nullPtr = failedTests.some((t) => /nullpointerexception/i.test(t.errorMessage ?? ""));
    const assertFailed = failedTests.some((t) =>
      /assert|System\.Assert/i.test(t.errorMessage ?? ""),
    );

    let rootCause: string;
    if (coverageFailed) {
      rootCause = "Apex test coverage is below the required threshold (75%).";
    } else if (nullPtr) {
      rootCause = "NullPointerException in test execution — test data factory likely missing a required field.";
    } else if (assertFailed) {
      rootCause =
        affectedTests.length > 0
          ? `Assertion failure in ${affectedTests[0]} — expected values do not match actual results.`
          : "Assertion failure in one or more Apex test methods.";
    } else {
      rootCause =
        affectedTests.length > 0
          ? `Apex test failure in ${affectedTests[0]}.`
          : "One or more Apex tests failed during validation.";
    }

    const baseConfidence = 55 + Math.min(failedTests.length * 8, 35);
    const confidence = calibrateConfidence(baseConfidence, evidence);

    return {
      category: this.category,
      confidence,
      rootCause,
      affectedComponents: affectedTests.slice(0, 5),
      evidence: [
        ...failedTests
          .slice(0, 3)
          .map((t) => `${t.testClass}.${t.methodName}: ${t.errorMessage ?? "no message"}`),
        ...matchingSignals.slice(0, 2),
      ],
      recommendedActions: [
        "Review TestDataFactory.cls and ensure all required fields are populated.",
        "Fix the assertion logic or update expected values in the failing test.",
        "Ensure all custom fields referenced in tests exist in the target org.",
        "Rerun CRT validation after fixing the test class.",
      ],
      suggestedCommand: "trinetra test run --suite smoke",
    };
  }
}

// ── Rule 3: Environment Drift ─────────────────────────────────────────────────

export class EnvironmentDriftRule implements DiagnosticRule {
  readonly name = "EnvironmentDriftRule";
  readonly category = "EnvironmentDrift" as const;

  evaluate(evidence: InvestigationEvidence): DiagnosticFinding | null {
    const signals = allSignals(evidence);
    const matching = extractMatchingSignals(signals, DRIFT_PATTERNS);

    // Also check promotion history for repeated failures on the same path
    const failedPromotions = evidence.promotionHistory.filter((p) => p.status === "failed");

    if (matching.length === 0 && failedPromotions.length < 2) return null;

    const environments = [
      ...new Set(failedPromotions.map((p) => `${p.fromEnvironment} → ${p.toEnvironment}`)),
    ];

    const baseConfidence = 45 + Math.min(matching.length * 10 + failedPromotions.length * 8, 40);
    const confidence = calibrateConfidence(baseConfidence, evidence);

    const targetEnv = evidence.deploymentLog?.environment ?? "target";

    return {
      category: this.category,
      confidence,
      rootCause:
        environments.length > 0
          ? `Metadata state drift detected between environments: ${environments.join(", ")}.`
          : `Metadata exists in source org but is absent or misconfigured in ${targetEnv}.`,
      affectedComponents: matching.slice(0, 3),
      evidence: [
        ...matching.slice(0, 3),
        ...(failedPromotions.length > 0
          ? [`${failedPromotions.length} repeated promotion failures detected on this path.`]
          : []),
      ],
      recommendedActions: [
        `Synchronize ${targetEnv} environment metadata before next promotion.`,
        "Compare metadata snapshots between source and target using a diff tool.",
        "Consider running a full environment refresh for the target org.",
      ],
      suggestedCommand: `trinetra doctor promotion --env ${targetEnv}`,
    };
  }
}

// ── Rule 4: Pipeline Configuration Failure ───────────────────────────────────

export class PipelineConfigRule implements DiagnosticRule {
  readonly name = "PipelineConfigRule";
  readonly category = "PipelineConfigurationFailure" as const;

  evaluate(evidence: InvestigationEvidence): DiagnosticFinding | null {
    const signals = allSignals(evidence);
    const matching = extractMatchingSignals(signals, PIPELINE_CONFIG_PATTERNS);

    if (matching.length === 0) return null;

    const baseConfidence = 50 + Math.min(matching.length * 12, 35);
    const confidence = calibrateConfidence(baseConfidence, evidence);

    return {
      category: this.category,
      confidence,
      rootCause:
        "Pipeline configuration error detected — promotion path, approval gate, or policy rule may be misconfigured.",
      affectedComponents: [],
      evidence: matching.slice(0, 4),
      recommendedActions: [
        "Verify the pipeline stage configuration in Copado setup.",
        "Ensure required approval groups are assigned for this environment.",
        "Review deployment policies for policy violations.",
        "Check that the promotion path exists between source and target environments.",
      ],
      suggestedCommand: "trinetra doctor pipeline",
    };
  }
}

// ── Registry: all built-in rules ─────────────────────────────────────────────

export const BUILT_IN_RULES: DiagnosticRule[] = [
  new MetadataDependencyRule(),
  new ApexTestFailureRule(),
  new EnvironmentDriftRule(),
  new PipelineConfigRule(),
];

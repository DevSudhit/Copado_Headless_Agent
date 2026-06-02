// ────────────────────────────────────────────────────────────────────────────
// Doctor Engine – shared types
// ────────────────────────────────────────────────────────────────────────────

export type DiagnosticCategory =
  | "MetadataDependencyFailure"
  | "ApexTestFailure"
  | "EnvironmentDrift"
  | "PipelineConfigurationFailure"
  | "Unknown";

export type ConfidenceTier = "High" | "Medium" | "Low";

export type InvestigationTarget = "deployment" | "promotion" | "test" | "commit";

// ── Raw evidence gathered from Copado APIs ──────────────────────────────────

export interface DeploymentLog {
  deploymentId: string;
  status: "success" | "failed" | "running" | "queued";
  environment: string;
  startedAt: string;
  finishedAt?: string;
  steps: DeploymentStep[];
  rawLogs: string[];
}

export interface DeploymentStep {
  name: string;
  status: "success" | "failed" | "skipped";
  message?: string;
}

export interface JobExecution {
  jobId: string;
  jobTemplate: string;
  status: "success" | "failed" | "running" | "queued";
  errorMessage?: string;
  steps: JobStep[];
}

export interface JobStep {
  name: string;
  status: "success" | "failed" | "skipped";
  errorMessage?: string;
  duration?: number;
}

export interface StoryMetadata {
  storyId: string;
  title: string;
  status: string;
  description?: string;
  metadataComponents: string[];
  lastModifiedBy?: string;
  lastModifiedDate?: string;
}

export interface PromotionHistoryEntry {
  promotionId: string;
  fromEnvironment: string;
  toEnvironment: string;
  status: "success" | "failed" | "pending";
  promotedAt: string;
  validationStatus?: "passed" | "failed" | "skipped";
}

export interface TestResult {
  testClass: string;
  methodName: string;
  status: "passed" | "failed" | "skipped";
  errorMessage?: string;
  stackTrace?: string;
  coveragePercent?: number;
}

export interface CrtTestSuite {
  executionId: string;
  suiteId: string;
  status: "passed" | "failed" | "running";
  totalTests: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

// ── Normalised investigation model ──────────────────────────────────────────

export interface InvestigationEvidence {
  deploymentLog?: DeploymentLog;
  jobExecution?: JobExecution;
  storyMetadata?: StoryMetadata;
  promotionHistory: PromotionHistoryEntry[];
  testSuite?: CrtTestSuite;
  rawSignals: string[];
}

// ── Diagnostic finding produced by a rule ───────────────────────────────────

export interface DiagnosticFinding {
  category: DiagnosticCategory;
  confidence: number; // 0-100
  rootCause: string;
  affectedComponents: string[];
  evidence: string[];
  recommendedActions: string[];
  suggestedCommand?: string;
}

// ── Aggregated investigation report ─────────────────────────────────────────

export interface InvestigationReport {
  targetId: string;
  targetType: InvestigationTarget;
  investigatedAt: string;
  status: "passed" | "failed" | "inconclusive";
  primaryFinding: DiagnosticFinding | null;
  allFindings: DiagnosticFinding[];
  confidenceTier: ConfidenceTier;
  aiInsights?: string;
  collectionSummary: CollectionSummary;
}

export interface CollectionSummary {
  deploymentLogs: boolean;
  jobExecution: boolean;
  storyDetails: boolean;
  promotionHistory: boolean;
  testResults: boolean;
}

// ── JSON output shape ────────────────────────────────────────────────────────

export interface InvestigationReportJson {
  status: string;
  failureType: DiagnosticCategory | "None";
  confidence: number;
  confidenceTier: ConfidenceTier;
  rootCause: string;
  affectedComponents: string[];
  recommendedActions: string[];
  suggestedCommand?: string;
  aiInsights?: string;
  allFindings: DiagnosticFindingJson[];
  investigatedAt: string;
}

export interface DiagnosticFindingJson {
  category: DiagnosticCategory;
  confidence: number;
  rootCause: string;
  affectedComponents: string[];
  evidence: string[];
  recommendedActions: string[];
}

// ── Rule contract (Strategy Pattern) ─────────────────────────────────────────

export interface DiagnosticRule {
  readonly name: string;
  readonly category: DiagnosticCategory;
  evaluate(evidence: InvestigationEvidence): DiagnosticFinding | null;
}

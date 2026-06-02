// ────────────────────────────────────────────────────────────────────────────
// Replay Engine — shared types
// ────────────────────────────────────────────────────────────────────────────

export type EntityType = "deployment" | "promotion" | "test" | "commit" | "story";
export type EventStatus = "success" | "failed" | "warning" | "info" | "running" | "skipped";
export type EventSource = "copado" | "salesforce" | "git" | "crt" | "doctor" | "ai";

// ── Single timeline event ─────────────────────────────────────────────────────

export interface TimelineEvent {
  /** ISO-8601 timestamp */
  timestamp: string;
  source: EventSource;
  status: EventStatus;
  /** Short category label (e.g. "Commit", "Promotion", "Deploy") */
  category: string;
  description: string;
  /** Optional bullet-point detail lines shown under the event */
  details?: string[];
}

// ── Environment journey ───────────────────────────────────────────────────────

export type StageStatus = "completed" | "failed" | "pending" | "blocked";

export interface EnvironmentStage {
  name: string;
  status: StageStatus;
  timestamp?: string;
}

export interface EnvironmentJourney {
  stages: EnvironmentStage[];
}

// ── Metadata change summary ───────────────────────────────────────────────────

export interface MetadataChangeSummary {
  added: string[];
  modified: string[];
  deleted: string[];
}

// ── Doctor Engine summary embedded in replay ──────────────────────────────────

export interface DoctorSummary {
  status: string;
  confidence: number;
  confidenceTier: "High" | "Medium" | "Low";
  rootCause: string;
  affectedComponents: string[];
  recommendedActions: string[];
  /** AI insights from the embedded Doctor Engine analysis */
  aiInsights?: string;
}

// ── Full replay report ────────────────────────────────────────────────────────

export interface ReplayReport {
  entityId: string;
  entityType: EntityType;
  storyId?: string;
  storyTitle?: string;
  storyStatus?: string;
  project?: string;
  environment?: string;
  replayedAt: string;
  timeline: TimelineEvent[];
  environmentJourney?: EnvironmentJourney;
  metadataChanges?: MetadataChangeSummary;
  doctorFindings?: DoctorSummary;
  /** Populated only when --ai flag is passed (separate from Doctor AI) */
  aiInsights?: string;
  outcome: "success" | "failed" | "inconclusive" | "in-progress";
  currentState?: string;
  blockingIssue?: string;
}

// ── Options passed into the engine ───────────────────────────────────────────

export interface ReplayOptions {
  diff: boolean;
  incident: boolean;
  ai: boolean;
}

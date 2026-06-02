// ────────────────────────────────────────────────────────────────────────────
// Replay Engine — core orchestrator
// Aggregates evidence from Salesforce, Doctor Engine, and optionally AI into
// a single ReplayReport.
// ────────────────────────────────────────────────────────────────────────────

import { createAiClient } from "../clients/ai-client.js";
import { DoctorEngine } from "../doctor/doctor-engine.js";
import type { InvestigationTarget } from "../doctor/doctor-types.js";
import { CollectedData, collectLiveData } from "./event-collector.js";
import {
  buildEnvironmentJourney,
  buildMetadataChangeSummary,
  buildTimeline,
} from "./timeline-builder.js";
import {
  DoctorSummary,
  EntityType,
  ReplayOptions,
  ReplayReport,
  TimelineEvent,
} from "./replay-types.js";

// ── Entity type auto-detection from ID prefix ─────────────────────────────────

export function detectEntityType(entityId: string): EntityType {
  if (/^US-\d+/i.test(entityId)) return "story";
  if (/^DEP-/i.test(entityId)) return "deployment";
  if (/^PRO-/i.test(entityId)) return "promotion";
  if (/^EX-/i.test(entityId)) return "test";
  if (/^COM-/i.test(entityId)) return "commit";
  // Unknown prefix — treat as story investigation
  return "story";
}

// ── Map EntityType to InvestigationTarget (story is not a Doctor target) ──────

function toDoctorTarget(entityType: EntityType): InvestigationTarget {
  if (entityType === "story") return "deployment";
  return entityType as InvestigationTarget;
}

// ── Replay Engine ─────────────────────────────────────────────────────────────

export class ReplayEngine {
  private readonly doctorEngine = new DoctorEngine();
  private readonly aiClient = createAiClient();

  async replay(
    entityId: string,
    entityType: EntityType,
    options: ReplayOptions,
  ): Promise<ReplayReport> {
    // ── 1. Collect raw Salesforce data ────────────────────────────────────────
    const data = collectLiveData(entityId, entityType);

    // ── 2. Build timeline ─────────────────────────────────────────────────────
    const timeline = buildTimeline(data, entityId, entityType);

    // ── 3. Build environment journey ──────────────────────────────────────────
    const environmentJourney = buildEnvironmentJourney(data);

    // ── 4. Build metadata change summary ──────────────────────────────────────
    const metadataChanges = buildMetadataChangeSummary(data, entityId);

    // ── 5. Embed Doctor Engine findings ───────────────────────────────────────
    // Run the Doctor Engine against the real story/entity so findings are
    // always embedded in the replay without needing a separate command.
    const targetForDoctor = data.story?.name ?? entityId;
    let doctorFindings: DoctorSummary | undefined;

    try {
      const investigation = await this.doctorEngine.investigate(
        targetForDoctor,
        toDoctorTarget(entityType),
      );
      doctorFindings = {
        status: investigation.status,
        confidence: investigation.primaryFinding?.confidence ?? 0,
        confidenceTier: investigation.confidenceTier,
        rootCause:
          investigation.primaryFinding?.rootCause ?? "No root cause identified.",
        affectedComponents: investigation.primaryFinding?.affectedComponents ?? [],
        recommendedActions: investigation.primaryFinding?.recommendedActions ?? [],
        aiInsights: investigation.aiInsights,
      };
    } catch {
      // Doctor Engine failure must not block the replay
    }

    // ── 6. Optional AI incident analysis (--ai flag) ──────────────────────────
    let aiInsights: string | undefined;
    if (options.ai) {
      try {
        const prompt = buildAiPrompt(entityId, entityType, data, timeline, doctorFindings);
        const response = await this.aiClient.ask({ agent: "release", prompt });
        aiInsights = response.answer;
      } catch {
        aiInsights = "(AI analysis unavailable — check COPADO_AI_* environment variables)";
      }
    }

    // ── 7. Determine overall outcome ──────────────────────────────────────────
    const hasFailedEvent = timeline.some((e) => e.status === "failed");
    const hasAnyPipeline =
      data.promotions.length > 0 || data.deployments.length > 0;

    let outcome: ReplayReport["outcome"];
    if (hasFailedEvent) {
      outcome = "failed";
    } else if (!hasAnyPipeline && data.live) {
      outcome = "in-progress";
    } else if (hasAnyPipeline) {
      outcome = "inconclusive";
    } else {
      // Mock data — simulate failure for demo richness
      outcome = "failed";
    }

    // Current state & blocking issue
    let currentState: string;
    let blockingIssue: string | undefined;

    if (outcome === "failed") {
      const failedEvent = timeline.find((e) => e.status === "failed");
      currentState = `Blocked at ${failedEvent?.category ?? "unknown step"}`;
      blockingIssue = failedEvent?.description;
    } else if (outcome === "in-progress") {
      currentState = `Story is ${data.story?.status ?? "active"} — awaiting pipeline activity`;
    } else {
      currentState = data.story?.status ?? "Unknown";
    }

    return {
      entityId,
      entityType,
      storyId: data.story?.name,
      storyTitle: data.story?.title,
      storyStatus: data.story?.status,
      project: data.story?.project || undefined,
      environment: data.story?.environment || undefined,
      replayedAt: new Date().toISOString(),
      timeline,
      environmentJourney,
      metadataChanges,
      doctorFindings,
      aiInsights,
      outcome,
      currentState,
      blockingIssue,
    };
  }
}

// ── AI prompt builder ─────────────────────────────────────────────────────────

function buildAiPrompt(
  entityId: string,
  entityType: EntityType,
  data: CollectedData,
  timeline: TimelineEvent[],
  doctor?: DoctorSummary,
): string {
  const failedEvents = timeline.filter((e) => e.status === "failed");
  const lines: string[] = [
    `You are a Copado DevOps incident commander analyzing a ${entityType} replay.`,
    ``,
    `Entity: ${entityId}`,
    `Story: ${data.story?.name ?? entityId} — "${data.story?.title ?? "unknown"}"`,
    `Status: ${data.story?.status ?? "unknown"}`,
    ``,
    `Timeline summary:`,
    `  Total events: ${timeline.length}`,
    `  Failed events: ${failedEvents.length}`,
    `  Promotions: ${data.promotions.length}`,
    `  Deployments: ${data.deployments.length}`,
    `  Apex tests: ${data.apexTests.length}`,
  ];

  if (failedEvents.length > 0) {
    lines.push(``, `Failure details:`);
    for (const e of failedEvents) {
      lines.push(`  - [${e.category}] ${e.description}`);
      for (const d of e.details ?? []) lines.push(`    • ${d}`);
    }
  }

  if (doctor && doctor.confidence > 0) {
    lines.push(
      ``,
      `Doctor Engine findings:`,
      `  Root cause: ${doctor.rootCause}`,
      `  Confidence: ${doctor.confidence}% (${doctor.confidenceTier})`,
      `  Affected: ${doctor.affectedComponents.join(", ") || "none"}`,
    );
  }

  lines.push(
    ``,
    `Question: What sequence of events most likely caused this outcome?`,
    `Provide a concise incident commander summary with:`,
    `1. What happened (chronological narrative)`,
    `2. Root cause assessment`,
    `3. Immediate remediation steps`,
  );

  return lines.join("\n");
}

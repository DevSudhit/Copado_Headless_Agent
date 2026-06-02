// ────────────────────────────────────────────────────────────────────────────
// Replay Engine — timeline builder
// Converts raw CollectedData into a rich, chronological set of timeline events,
// an environment journey, and a metadata change summary.
// ────────────────────────────────────────────────────────────────────────────

import { CollectedData } from "./event-collector.js";
import {
  EntityType,
  EnvironmentJourney,
  EnvironmentStage,
  MetadataChangeSummary,
  TimelineEvent,
} from "./replay-types.js";

// ── Timeline from live Salesforce data ───────────────────────────────────────

export function buildTimeline(
  data: CollectedData,
  entityId: string,
  entityType: EntityType,
): TimelineEvent[] {
  if (!data.live || !data.story) {
    return buildMockTimeline(entityId, entityType);
  }

  const events: TimelineEvent[] = [];
  const story = data.story;

  // Story created event
  events.push({
    timestamp: story.createdDate,
    source: "copado",
    status: "success",
    category: "Story",
    description: `Story ${story.name} created — "${story.title}"`,
    details: [
      story.project ? `Project: ${story.project}` : undefined,
      story.environment ? `Environment: ${story.environment}` : undefined,
      `Created by: ${story.createdBy}`,
    ].filter((x): x is string => Boolean(x)),
  });

  // Status update event (if modified after creation)
  if (story.lastModifiedDate !== story.createdDate) {
    events.push({
      timestamp: story.lastModifiedDate,
      source: "copado",
      status: "info",
      category: "Story",
      description: `Story status updated → ${story.status}`,
      details: [`Last modified by: ${story.lastModifiedBy}`],
    });
  }

  // Apex coverage event (when data exists)
  if (story.apexCoverage !== null) {
    const coverageOk = story.apexCoverage >= 75;
    events.push({
      timestamp: story.lastModifiedDate,
      source: "salesforce",
      status: coverageOk ? "success" : "warning",
      category: "Apex Coverage",
      description: `Apex code coverage: ${story.apexCoverage}%`,
      details: coverageOk ? [] : ["Coverage is below the 75% threshold — deployment may be blocked."],
    });
  }

  // CLI-initiated commits (from local .copado-hx.state.json)
  const storyCLICommits = data.cliCommits.filter((c) => c.storyId === story.name);
  for (const c of storyCLICommits) {
    events.push({
      timestamp: c.timestamp,
      source: "git",
      status: "success",
      category: "Commit",
      description: `CLI commit: "${c.message}"`,
      details: [`Operation ID: ${c.operationId}`, `Committed via trinetra/copado-hx CLI`],
    });
  }

  // Last commit date from Copado story field (actual Copado git commit)
  if (story.lastCommitDate) {
    events.push({
      timestamp: story.lastCommitDate,
      source: "git",
      status: "success",
      category: "Commit",
      description: `Metadata committed to Copado on ${new Date(story.lastCommitDate).toLocaleDateString()}`,
      details: [`Story: ${story.name}`, `Last commit recorded by Copado`],
    });
  }

  // Last promotion date (from story field, may differ from live promotion records)
  if (story.lastPromotionDate && data.promotions.length === 0) {
    events.push({
      timestamp: story.lastPromotionDate,
      source: "copado",
      status: "info",
      category: "Promotion",
      description: "Promotion activity recorded on user story (details unavailable)",
      details: ["The story field records a promotion date but no promotion records were found."],
    });
  }

  // Promotion events
  for (const p of data.promotions) {
    const isFailed = p.status?.toLowerCase().includes("fail") ?? false;
    const isComplete = p.status?.toLowerCase().includes("complet") ?? false;
    events.push({
      timestamp: p.date,
      source: "copado",
      status: isFailed ? "failed" : isComplete ? "success" : "running",
      category: "Promotion",
      description: `Promotion ${p.name}: ${p.sourceEnv} → ${p.targetEnv}`,
      details: [`Status: ${p.status}`],
    });
  }

  // Deployment events
  for (const dep of data.deployments) {
    const isFailed = dep.status?.toLowerCase().includes("fail") ?? false;
    const isSuccess =
      (dep.status?.toLowerCase().includes("success") ?? false) ||
      (dep.status?.toLowerCase().includes("complet") ?? false);
    events.push({
      timestamp: dep.date,
      source: "copado",
      status: isFailed ? "failed" : isSuccess ? "success" : "running",
      category: "Deployment",
      description: `Deployment ${dep.name} — ${dep.sourceEnv}`,
      details: [
        `Status: ${dep.status}`,
        dep.lastStep ? `Last step: ${dep.lastStep}` : undefined,
      ].filter((x): x is string => Boolean(x)),
    });
  }

  // Apex test events
  for (const a of data.apexTests) {
    const isFailed = a.status?.toLowerCase().includes("fail") ?? false;
    events.push({
      timestamp: story.lastModifiedDate,
      source: "crt",
      status: isFailed ? "failed" : "success",
      category: "Apex Test",
      description: `Apex test result: ${a.name}`,
      details: [`Result: ${a.status}`],
    });
  }

  // No pipeline activity note (most common state for a fresh story)
  if (data.promotions.length === 0 && data.deployments.length === 0) {
    events.push({
      timestamp: new Date().toISOString(),
      source: "copado",
      status: "warning",
      category: "Pipeline",
      description: "No promotion or deployment activity recorded for this story",
      details: [
        "The story has not been promoted or deployed yet.",
        "Next step: commit metadata changes and trigger a promotion via the pipeline.",
      ],
    });
  }

  // Sort all events chronologically
  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// ── Environment journey ───────────────────────────────────────────────────────

export function buildEnvironmentJourney(
  data: CollectedData,
): EnvironmentJourney | undefined {
  if (!data.live || !data.story) return buildMockEnvironmentJourney();

  const stages: EnvironmentStage[] = [];
  const seen = new Set<string>();

  // Source environment from the story
  if (data.story.environment) {
    stages.push({
      name: data.story.environment,
      status: "completed",
      timestamp: data.story.createdDate,
    });
    seen.add(data.story.environment);
  }

  // Target environments from promotions
  for (const p of data.promotions) {
    if (p.targetEnv && !seen.has(p.targetEnv)) {
      const isFailed = p.status?.toLowerCase().includes("fail") ?? false;
      stages.push({
        name: p.targetEnv,
        status: isFailed ? "failed" : "completed",
        timestamp: p.date,
      });
      seen.add(p.targetEnv);
    }
  }

  if (stages.length === 0) return undefined;

  return { stages };
}

// ── Metadata change summary ───────────────────────────────────────────────────
// Git integration is not yet wired. For live data we return undefined so the
// reporter omits the section. For mock data we generate a realistic sample.

export function buildMetadataChangeSummary(
  data: CollectedData,
  entityId: string,
): MetadataChangeSummary | undefined {
  if (data.live) return undefined;
  return buildMockMetadataChanges(entityId);
}

// ── Mock data (used when SF CLI is unavailable) ───────────────────────────────

function buildMockTimeline(entityId: string, entityType: EntityType): TimelineEvent[] {
  const base = Date.now() - 3_600_000 * 4; // 4 hours ago
  const at = (ms: number) => new Date(base + ms).toISOString();

  const storyId =
    entityType === "story" ? entityId : `US-${entityId.replace(/^[A-Z]+-/i, "")}`;
  const isFailed = !entityId.toLowerCase().includes("ok");

  const events: TimelineEvent[] = [
    {
      timestamp: at(0),
      source: "copado",
      status: "success",
      category: "Story",
      description: `Story ${storyId} selected for release`,
      details: ["Scoring service improvements", "Project: Core Platform"],
    },
    {
      timestamp: at(2 * 60_000),
      source: "git",
      status: "success",
      category: "Commit",
      description: "Commit started — retrieving metadata from org",
    },
    {
      timestamp: at(5 * 60_000),
      source: "git",
      status: "success",
      category: "Commit",
      description: "Commit completed — 3 components staged",
      details: ["LeadScoring.cls", "LeadScoringTest.cls", "Lead_Manager.permissionset"],
    },
    {
      timestamp: at(8 * 60_000),
      source: "copado",
      status: "success",
      category: "Promotion",
      description: "Promotion to UAT started (DEV → UAT)",
    },
    {
      timestamp: at(10 * 60_000),
      source: "copado",
      status: "success",
      category: "Validation",
      description: "Validation deployment started against UAT",
    },
    {
      timestamp: at(15 * 60_000),
      source: "copado",
      status: isFailed ? "failed" : "success",
      category: "Validation",
      description: isFailed
        ? "Validation FAILED — missing metadata dependency detected"
        : "Validation completed — all metadata verified",
      details: isFailed
        ? [
            "Missing CustomField: Lead.Score__c",
            "PermissionSet Lead_Manager references Lead.Score__c but it is not in deployment scope.",
          ]
        : ["All 3 components validated successfully."],
    },
  ];

  if (isFailed) {
    events.push(
      {
        timestamp: at(16 * 60_000),
        source: "doctor",
        status: "warning",
        category: "Doctor",
        description: "Doctor Engine analysis triggered automatically",
      },
      {
        timestamp: at(17 * 60_000),
        source: "doctor",
        status: "failed",
        category: "Doctor",
        description: "Root cause identified: Metadata Dependency Failure",
        details: [
          "Confidence: 92%",
          "Lead.Score__c is missing from the deployment scope.",
          "Recommended: Add Lead.Score__c to user story and rerun validation.",
        ],
      },
    );
  }

  return events;
}

function buildMockEnvironmentJourney(): EnvironmentJourney {
  return {
    stages: [
      { name: "DEV", status: "completed" },
      { name: "SIT", status: "completed" },
      { name: "UAT", status: "failed" },
      { name: "PROD", status: "pending" },
    ],
  };
}

function buildMockMetadataChanges(_entityId: string): MetadataChangeSummary {
  return {
    added: ["Lead.Score__c", "LeadScoring.cls", "LeadScoringTest.cls"],
    modified: ["Lead_Manager.permissionset"],
    deleted: [],
  };
}

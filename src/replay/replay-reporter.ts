// ────────────────────────────────────────────────────────────────────────────
// Replay Engine — reporter
// Renders ReplayReport as rich ANSI human-readable output or structured JSON.
// Supports --diff (change view), --incident (executive summary), and normal mode.
// ────────────────────────────────────────────────────────────────────────────

import {
  DoctorSummary,
  EntityType,
  EnvironmentJourney,
  MetadataChangeSummary,
  ReplayOptions,
  ReplayReport,
  TimelineEvent,
} from "./replay-types.js";

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan   = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const grey   = (s: string) => `\x1b[90m${s}\x1b[0m`;

const RULE = bold(cyan("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
const section = (title: string) =>
  bold(`─── ${title} ${"─".repeat(Math.max(0, 66 - title.length))}`);

// ── Small helpers ─────────────────────────────────────────────────────────────

function statusIcon(status: TimelineEvent["status"]): string {
  switch (status) {
    case "success": return green("✓");
    case "failed":  return red("✗");
    case "warning": return yellow("⚠");
    case "running": return cyan("↻");
    case "skipped": return grey("○");
    default:        return grey("·");
  }
}

function outcomeLabel(outcome: ReplayReport["outcome"]): string {
  switch (outcome) {
    case "success":     return green("SUCCESS");
    case "failed":      return red("FAILED");
    case "in-progress": return yellow("IN PROGRESS");
    default:            return yellow("INCONCLUSIVE");
  }
}

function sourceTag(source: TimelineEvent["source"]): string {
  const tags: Record<TimelineEvent["source"], string> = {
    copado:     dim("[COPADO]    "),
    salesforce: dim("[SFDC]      "),
    git:        dim("[GIT]       "),
    crt:        dim("[CRT]       "),
    doctor:     dim("[DOCTOR]    "),
    ai:         dim("[AI]        "),
  };
  return tags[source];
}

function entityLabel(type: EntityType): string {
  return type.toUpperCase() + " REPLAY";
}

function fmtTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts.slice(11, 19);
  }
}

function stripMarkdown(s: string): string {
  return s
    .replace(/^#{1,4}\s*/gm, "")   // headings
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/\*(.*?)\*/g, "$1");    // italic
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderBanner(report: ReplayReport): string {
  return [
    "",
    RULE,
    bold(`  TRINETRA REPLAY ENGINE  ·  ${entityLabel(report.entityType)}`),
    RULE,
    "",
    `  ${bold("Entity:")}   ${cyan(report.entityId)}`,
    report.storyTitle   ? `  ${bold("Title:")}    ${report.storyTitle}` : "",
    report.project      ? `  ${bold("Project:")}  ${report.project}` : "",
    report.storyStatus  ? `  ${bold("Status:")}   ${report.storyStatus}` : "",
    report.environment  ? `  ${bold("Env:")}      ${report.environment}` : "",
    `  ${bold("Outcome:")}  ${outcomeLabel(report.outcome)}`,
  ].filter(Boolean).join("\n");
}

function renderTimeline(events: TimelineEvent[]): string {
  const lines: string[] = [`\n${section("TIMELINE")}`, ""];
  for (const ev of events) {
    const ts   = grey(fmtTime(ev.timestamp));
    const src  = sourceTag(ev.source);
    const icon = statusIcon(ev.status);
    const cat  = bold(ev.category.padEnd(13));
    lines.push(`  ${ts}  ${src}${icon}  ${cat} ${ev.description}`);
    for (const d of ev.details ?? []) {
      lines.push(`                       ${grey("└─")} ${grey(d)}`);
    }
  }
  return lines.join("\n");
}

function renderEnvironmentJourney(journey: EnvironmentJourney): string {
  const lines: string[] = [`\n${section("ENVIRONMENT JOURNEY")}`, ""];
  for (let i = 0; i < journey.stages.length; i++) {
    const stage = journey.stages[i];
    const icon =
      stage.status === "completed" ? green("✓") :
      stage.status === "failed"    ? red("✗")   :
      stage.status === "blocked"   ? red("⊘")   :
      grey("○");
    const suffix =
      stage.status === "blocked" ? red(" (Blocked)")   :
      stage.status === "pending" ? grey(" (Pending)")  :
      stage.status === "failed"  ? red(" (Failed)")    : "";
    lines.push(`  ${icon}  ${stage.name}${suffix}`);
    if (i < journey.stages.length - 1) {
      lines.push(`     ${grey("↓")}`);
    }
  }
  return lines.join("\n");
}

function renderMetadataChanges(changes: MetadataChangeSummary): string {
  const lines: string[] = [`\n${section("METADATA CHANGES")}`, ""];
  if (changes.added.length > 0) {
    lines.push(`  ${green("+ Added:")}    ${changes.added.join("  ")}`);
  }
  if (changes.modified.length > 0) {
    lines.push(`  ${yellow("~ Modified:")}  ${changes.modified.join("  ")}`);
  }
  if (changes.deleted.length > 0) {
    lines.push(`  ${red("- Deleted:")}   ${changes.deleted.join("  ")}`);
  }
  if (!changes.added.length && !changes.modified.length && !changes.deleted.length) {
    lines.push(`  ${grey("No metadata changes recorded.")}`);
  }
  return lines.join("\n");
}

function renderDoctorFindings(doctor: DoctorSummary): string {
  const lines: string[] = [`\n${section("DOCTOR FINDINGS")}`, ""];
  const tierColor =
    doctor.confidenceTier === "High"   ? green  :
    doctor.confidenceTier === "Medium" ? yellow : red;

  lines.push(`  ${bold("Status:")}     ${doctor.status.toUpperCase()}`);
  lines.push(`  ${bold("Confidence:")} ${tierColor(String(doctor.confidence) + "%")}  ${grey(`(${doctor.confidenceTier})`)}`);
  lines.push(`  ${bold("Root Cause:")} ${doctor.rootCause}`);

  if (doctor.affectedComponents.length > 0) {
    lines.push(`  ${bold("Affected:")}   ${doctor.affectedComponents.join(", ")}`);
  }
  if (doctor.recommendedActions.length > 0) {
    lines.push(`  ${bold("Recommend:")}  ${doctor.recommendedActions.slice(0, 2).join("  |  ")}`);
  }

  if (doctor.aiInsights) {
    lines.push(`\n  ${bold(yellow("AI INSIGHTS"))} ${grey("(from embedded Doctor Engine)")}`);
    // Show first 12 meaningful lines of AI insights
    const aiLines = doctor.aiInsights.split("\n")
      .map(stripMarkdown)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 12);
    for (const line of aiLines) {
      lines.push(`  ${grey("›")} ${line}`);
    }
  }

  return lines.join("\n");
}

function renderCurrentState(report: ReplayReport): string {
  const lines: string[] = [`\n${section("CURRENT STATE")}`, ""];
  lines.push(`  ${bold("State:")}    ${report.currentState ?? "Unknown"}`);
  if (report.blockingIssue) {
    lines.push(`  ${bold("Blocking:")} ${red(report.blockingIssue)}`);
  }
  return lines.join("\n");
}

// ── Diff mode ─────────────────────────────────────────────────────────────────

function renderDiff(report: ReplayReport): string {
  const lines: string[] = [
    "",
    RULE,
    bold("  TRINETRA REPLAY ENGINE  ·  DIFF MODE"),
    RULE,
    "",
    `  ${bold("Entity:")} ${cyan(report.entityId)}`,
    `  ${bold("Story:")}  ${report.storyId ?? "N/A"} — ${report.storyTitle ?? ""}`,
    `  Comparing changes against last successful deployment`,
    "",
    section("WHAT CHANGED"),
    "",
  ];

  const changes = report.metadataChanges;
  if (changes) {
    if (changes.added.length > 0) {
      lines.push(`  ${green("+ Added components:")}`);
      for (const c of changes.added) lines.push(`      ${green(c)}`);
    }
    if (changes.modified.length > 0) {
      lines.push(`  ${yellow("~ Modified components:")}`);
      for (const c of changes.modified) lines.push(`      ${yellow(c)}`);
    }
    if (changes.deleted.length > 0) {
      lines.push(`  ${red("- Deleted components:")}`);
      for (const c of changes.deleted) lines.push(`      ${red(c)}`);
    }

    if (report.doctorFindings?.affectedComponents.length) {
      lines.push(`\n  ${bold(yellow("Potential Risk:"))} ${report.doctorFindings.rootCause}`);
    }
  } else {
    lines.push(`  ${grey("No metadata diff available.")}`);
    lines.push(`  ${grey("Diff mode requires git integration (not yet configured).")}`);
    if (report.timeline.some((e) => e.status === "failed")) {
      lines.push(`\n  ${bold("Known failure detected in timeline:")}`);
      for (const ev of report.timeline.filter((e) => e.status === "failed")) {
        lines.push(`  ${red("✗")} ${ev.category}: ${ev.description}`);
      }
    }
  }

  lines.push(`\n${RULE}`);
  lines.push(grey(`  Replayed at: ${report.replayedAt}`));
  lines.push("");
  return lines.join("\n");
}

// ── Incident mode ─────────────────────────────────────────────────────────────

function estimateFixTime(doctor?: DoctorSummary): string {
  if (!doctor || doctor.confidence === 0) return "Unknown — investigation needed";
  if (doctor.confidence >= 90) return "5–15 minutes";
  if (doctor.confidence >= 70) return "15–60 minutes";
  return "1–4 hours (root cause uncertain)";
}

function renderIncident(report: ReplayReport): string {
  const doctor = report.doctorFindings;
  const lines: string[] = [
    "",
    RULE,
    bold("  TRINETRA REPLAY ENGINE  ·  INCIDENT REPORT"),
    RULE,
    "",
    `  ${bold("Deployment:")}  ${cyan(report.entityId)}`,
    report.storyId ? `  ${bold("Story:")}       ${report.storyId} — ${report.storyTitle ?? ""}` : "",
    `  ${bold("Outcome:")}     ${outcomeLabel(report.outcome)}`,
    "",
    section("IMPACT"),
    "",
    `  ${report.outcome === "failed"
        ? red("Deployment or validation failed — changes have not been promoted.")
        : report.outcome === "in-progress"
          ? yellow("Pipeline activity has not yet been recorded for this story.")
          : "Pipeline status is inconclusive."}`,
    "",
    section("ROOT CAUSE"),
    "",
    `  ${doctor?.rootCause ?? "No specific root cause identified. The pipeline may not have been triggered yet."}`,
    "",
    `  ${bold("Affected Story:")}     ${report.storyId ?? "N/A"}`,
    doctor?.affectedComponents.length
      ? `  ${bold("Affected Components:")} ${doctor.affectedComponents.join(", ")}`
      : "",
    "",
    section("RESOLUTION STEPS"),
    "",
    ...(doctor?.recommendedActions.length
      ? doctor.recommendedActions.map((a) => `  • ${a}`)
      : [
          "  • Ensure the user story has committed metadata components.",
          "  • Configure a pipeline connection between source and target environments.",
          "  • Trigger a promotion via Copado UI or trinetra promote command.",
        ]),
    "",
    `  ${bold("Confidence:")}      ${doctor ? `${doctor.confidence}% (${doctor.confidenceTier})` : "N/A"}`,
    `  ${bold("Est. Fix Time:")}   ${estimateFixTime(doctor)}`,
  ].filter(Boolean);

  if (report.aiInsights ?? doctor?.aiInsights) {
    const insights = report.aiInsights ?? doctor?.aiInsights ?? "";
    lines.push(`\n${section("AI INCIDENT COMMANDER")}`);
    const aiLines = insights.split("\n")
      .map(stripMarkdown).map((l) => l.trim()).filter(Boolean).slice(0, 20);
    for (const line of aiLines) {
      lines.push(`  ${line}`);
    }
  }

  lines.push(`\n${RULE}`);
  lines.push(grey(`  Replayed at: ${report.replayedAt}`));
  lines.push("");
  return lines.join("\n");
}

// ── Story lifecycle mode ──────────────────────────────────────────────────────

function renderStoryLifecycle(report: ReplayReport): string {
  const lines: string[] = [`\n${section("STORY LIFECYCLE")}`, ""];

  // Derive milestone status from timeline
  const hasCommit     = report.timeline.some((e) => e.category === "Commit" && e.status === "success");
  const hasPromotion  = report.timeline.some((e) => e.category === "Promotion");
  const hasDeployment = report.timeline.some((e) => e.category === "Deployment");
  const hasFailed     = report.timeline.some((e) => e.status === "failed");

  // A story whose status is not "Draft" or "Scheduled" has had at least
  // some pipeline activity — treat it as having a commit in progress.
  const statusImpliesCommit = !["Draft", "Scheduled", ""].includes(report.storyStatus ?? "");

  const milestones = [
    { label: "Story Created",     done: true },
    { label: "Metadata Modified", done: hasCommit || statusImpliesCommit },
    { label: "Commit Completed",  done: hasCommit || statusImpliesCommit },
    { label: "Promotion Started", done: hasPromotion },
    { label: "Deployment Ran",    done: hasDeployment, failed: hasFailed },
  ];

  for (const m of milestones) {
    const icon = m.failed ? red("✗") : m.done ? green("✓") : grey("○");
    lines.push(`  ${icon}  ${m.failed ? red(m.label) : m.done ? m.label : grey(m.label)}`);
  }

  return lines.join("\n");
}

// ── Main human-readable renderer ──────────────────────────────────────────────

export function renderHumanReport(report: ReplayReport, options: ReplayOptions): string {
  if (options.diff)     return renderDiff(report);
  if (options.incident) return renderIncident(report);

  const lines: string[] = [renderBanner(report)];

  // Story-centric view adds lifecycle section
  if (report.entityType === "story") {
    lines.push(renderStoryLifecycle(report));
  }

  lines.push(renderTimeline(report.timeline));

  if (report.environmentJourney) {
    lines.push(renderEnvironmentJourney(report.environmentJourney));
  }

  if (report.metadataChanges) {
    lines.push(renderMetadataChanges(report.metadataChanges));
  }

  if (report.doctorFindings) {
    lines.push(renderDoctorFindings(report.doctorFindings));
  }

  // Standalone AI insights (from --ai flag, different from Doctor's AI)
  if (report.aiInsights && !report.doctorFindings?.aiInsights) {
    lines.push(`\n${section("AI INSIGHTS")}`);
    lines.push("");
    const aiLines = report.aiInsights.split("\n")
      .map(stripMarkdown).map((l) => l.trim()).filter(Boolean).slice(0, 15);
    for (const line of aiLines) {
      lines.push(`  ${grey("›")} ${line}`);
    }
  }

  if (report.currentState) {
    lines.push(renderCurrentState(report));
  }

  lines.push(`\n${RULE}`);
  lines.push(grey(`  Replayed at: ${report.replayedAt}`));
  lines.push("");
  return lines.join("\n");
}

// ── JSON renderer ─────────────────────────────────────────────────────────────

export function renderJsonReport(report: ReplayReport): Record<string, unknown> {
  return {
    entityId:           report.entityId,
    entityType:         report.entityType,
    storyId:            report.storyId,
    storyTitle:         report.storyTitle,
    storyStatus:        report.storyStatus,
    project:            report.project,
    outcome:            report.outcome,
    currentState:       report.currentState,
    blockingIssue:      report.blockingIssue,
    timelineEventCount: report.timeline.length,
    timeline:           report.timeline,
    environmentJourney: report.environmentJourney,
    metadataChanges:    report.metadataChanges,
    doctorFindings:     report.doctorFindings,
    aiInsights:         report.aiInsights,
    replayedAt:         report.replayedAt,
  };
}

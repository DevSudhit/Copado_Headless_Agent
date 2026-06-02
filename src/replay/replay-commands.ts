// ────────────────────────────────────────────────────────────────────────────
// Replay Engine — CLI commands
// Registers all `trinetra replay *` commands and their --diff/--incident/--ai
// option flags.
// ────────────────────────────────────────────────────────────────────────────

import { Command } from "commander";
import { getJsonFlag, runCommand } from "../commands/command-support.js";
import { detectEntityType, ReplayEngine } from "./replay-engine.js";
import { renderHumanReport, renderJsonReport } from "./replay-reporter.js";
import { EntityType, ReplayOptions } from "./replay-types.js";

const engine = new ReplayEngine();

// ── Extract replay-specific flags from a command ──────────────────────────────

function getReplayOptions(command: Command): ReplayOptions {
  const opts = command.optsWithGlobals();
  return {
    diff:     Boolean(opts["diff"]),
    incident: Boolean(opts["incident"]),
    ai:       Boolean(opts["ai"]),
  };
}

// ── Shared action: replay → report ───────────────────────────────────────────

async function replayAndOutput(
  entityId: string,
  entityType: EntityType,
  command: Command,
): Promise<void> {
  await runCommand(command, async () => {
    const options = getReplayOptions(command);
    const report  = await engine.replay(entityId, entityType, options);
    const asJson  = getJsonFlag(command);

    if (asJson) {
      return {
        summary: JSON.stringify(renderJsonReport(report), null, 2),
        data:    renderJsonReport(report),
      };
    }

    return {
      summary: renderHumanReport(report, options),
      data:    report,
    };
  });
}

// ── Shared option adder ───────────────────────────────────────────────────────

function withReplayOptions(cmd: Command): Command {
  return cmd
    .option("--diff",     "Show what changed since last successful deployment")
    .option("--incident", "Generate an executive-friendly incident summary")
    .option("--ai",       "Invoke Copado Release Agent for AI incident analysis");
}

// ── Register all replay commands ──────────────────────────────────────────────

export function registerReplayCommands(program: Command): void {

  // ── trinetra replay [id]  — auto-detect entity type ──────────────────────
  const replay = withReplayOptions(
    program
      .command("replay [id]")
      .description(
        "Replay the full timeline of any Copado entity. " +
        "Auto-detects type from ID prefix: US-=story, DEP-=deployment, " +
        "PRO-=promotion, EX-=test, COM-=commit.",
      ),
  ).action(async (id: string | undefined, _opts: unknown, command: Command) => {
    const entityId   = id ?? "UNKNOWN";
    const entityType = detectEntityType(entityId);
    await replayAndOutput(entityId, entityType, command);
  });

  // ── trinetra replay story <storyId> ──────────────────────────────────────
  withReplayOptions(
    replay
      .command("story <storyId>")
      .description(
        "Replay the full lifecycle of a Copado user story — commits, " +
        "promotions, deployments, test runs, and environment journey.",
      ),
  ).action(async (storyId: string, _opts: unknown, command: Command) => {
    await replayAndOutput(storyId, "story", command);
  });

  // ── trinetra replay deployment <id> ──────────────────────────────────────
  withReplayOptions(
    replay
      .command("deployment <id>")
      .description(
        "Replay a specific Copado deployment — all steps, logs, and " +
        "embedded Doctor findings.",
      ),
  ).action(async (id: string, _opts: unknown, command: Command) => {
    await replayAndOutput(id, "deployment", command);
  });

  // ── trinetra replay promotion <id> ────────────────────────────────────────
  withReplayOptions(
    replay
      .command("promotion <id>")
      .description(
        "Replay a Copado promotion — environment transitions, validation, " +
        "deployment steps, and Doctor findings.",
      ),
  ).action(async (id: string, _opts: unknown, command: Command) => {
    await replayAndOutput(id, "promotion", command);
  });

  // ── trinetra replay test <id> ─────────────────────────────────────────────
  withReplayOptions(
    replay
      .command("test <id>")
      .description(
        "Replay a CRT test execution — individual test results, failure " +
        "details, and coverage data.",
      ),
  ).action(async (id: string, _opts: unknown, command: Command) => {
    await replayAndOutput(id, "test", command);
  });

  // ── trinetra replay commit <id> ───────────────────────────────────────────
  withReplayOptions(
    replay
      .command("commit <id>")
      .description(
        "Replay a Copado commit pipeline run — metadata staging, branch " +
        "events, and validation results.",
      ),
  ).action(async (id: string, _opts: unknown, command: Command) => {
    await replayAndOutput(id, "commit", command);
  });
}

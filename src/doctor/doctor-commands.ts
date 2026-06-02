// ────────────────────────────────────────────────────────────────────────────
// Doctor Engine – CLI command registrations
//
// Exposes five user-facing entry points:
//   trinetra doctor deployment <id>
//   trinetra doctor promotion  <id>
//   trinetra doctor test       <id>
//   trinetra doctor commit     <id>
//   trinetra investigate [id]
//   trinetra investigate --job <jobId>
//   trinetra why [id]
// ────────────────────────────────────────────────────────────────────────────

import { Command } from "commander";
import { getJsonFlag, runCommand } from "../commands/command-support.js";
import { DoctorEngine } from "./doctor-engine.js";
import { renderHumanReport, renderJsonReport } from "./doctor-reporter.js";
import { InvestigationTarget } from "./doctor-types.js";

// ── Shared engine (singleton per process) ─────────────────────────────────────

const engine = new DoctorEngine();

// ── Shared investigate action ─────────────────────────────────────────────────

async function investigateAndOutput(
  targetId: string,
  targetType: InvestigationTarget,
  command: Command,
): Promise<void> {
  await runCommand(command, async () => {
    const report = await engine.investigate(targetId, targetType);
    const asJson = getJsonFlag(command);

    if (asJson) {
      return {
        summary: JSON.stringify(renderJsonReport(report), null, 2),
        data: renderJsonReport(report),
      };
    }

    return {
      summary: renderHumanReport(report),
      data: report,
    };
  });
}

// ── `trinetra doctor` sub-command tree ────────────────────────────────────────

export function registerDoctorCommands(program: Command): void {
  const doctor = program
    .command("doctor")
    .description(
      "Intelligent diagnostics — analyze deployments, promotions, tests, and commits to identify root causes.",
    );

  // ── doctor deployment ──────────────────────────────────────────────────────
  doctor
    .command("deployment <id>")
    .description("Diagnose a failed or suspect deployment by ID")
    .action(async (id: string, _options: unknown, command: Command) => {
      await investigateAndOutput(id, "deployment", command);
    });

  // ── doctor promotion ───────────────────────────────────────────────────────
  doctor
    .command("promotion <id>")
    .description("Diagnose a failed or stalled promotion by ID")
    .action(async (id: string, _options: unknown, command: Command) => {
      await investigateAndOutput(id, "promotion", command);
    });

  // ── doctor test ────────────────────────────────────────────────────────────
  doctor
    .command("test <id>")
    .description("Diagnose a CRT test execution by ID or suite name")
    .action(async (id: string, _options: unknown, command: Command) => {
      await investigateAndOutput(id, "test", command);
    });

  // ── doctor commit ──────────────────────────────────────────────────────────
  doctor
    .command("commit <id>")
    .description("Diagnose a commit pipeline run by ID")
    .action(async (id: string, _options: unknown, command: Command) => {
      await investigateAndOutput(id, "commit", command);
    });
}

// ── `trinetra investigate` ────────────────────────────────────────────────────

export function registerInvestigateCommand(program: Command): void {
  program
    .command("investigate [id]")
    .description(
      "Investigate a deployment, job, or pipeline item — the default entry point for the Doctor Engine.",
    )
    .option("--job <jobId>", "Investigate a specific job execution ID")
    .option("--type <type>", "Target type: deployment | promotion | test | commit", "deployment")
    .action(async (id: string | undefined, options: { job?: string; type?: string }, command: Command) => {
      const targetId = options.job ?? id;

      if (!targetId) {
        console.error(
          "Error: Provide a target ID as a positional argument or via --job <jobId>.",
        );
        process.exitCode = 1;
        return;
      }

      const targetType = (options.type ?? "deployment") as InvestigationTarget;
      const validTypes: InvestigationTarget[] = ["deployment", "promotion", "test", "commit"];

      if (!validTypes.includes(targetType)) {
        console.error(
          `Error: --type must be one of: ${validTypes.join(", ")}`,
        );
        process.exitCode = 1;
        return;
      }

      await investigateAndOutput(targetId, targetType, command);
    });
}

// ── `trinetra why` ────────────────────────────────────────────────────────────
// Friendly alias for `investigate` — intended for interactive use.

export function registerWhyCommand(program: Command): void {
  program
    .command("why [id]")
    .description(
      "Ask the Doctor Engine why a deployment, promotion, or test failed — shorthand for 'investigate'.",
    )
    .option("--type <type>", "Target type: deployment | promotion | test | commit", "deployment")
    .action(async (id: string | undefined, options: { type?: string }, command: Command) => {
      if (!id) {
        console.error(
          "Error: Provide a target ID, e.g. `trinetra why DEPLOY-781`.",
        );
        process.exitCode = 1;
        return;
      }

      const targetType = (options.type ?? "deployment") as InvestigationTarget;
      await investigateAndOutput(id, targetType, command);
    });
}

import process from "node:process";
import { createInterface } from "node:readline/promises";

import { Command } from "commander";

import { requiresExplicitApproval } from "../policies/approval-policy.js";
import { PipelineService } from "../services/pipeline-service.js";
import { CliError } from "../types/commands.js";

import { runCommand } from "./command-support.js";

interface CommitOptions {
  message?: string;
  us?: string;
  id?: string;
}

interface PromoteOptions {
  env: string;
  validate?: boolean;
  us?: string;
  id?: string;
}

interface DeployOptions {
  env: string;
  approve?: boolean;
  us?: string;
  id?: string;
}

function resolveStoryOverride(options: { us?: string; id?: string }): string | undefined {
  return options.us?.trim() || options.id?.trim() || undefined;
}

async function resolveDeploymentApproval(environment: string, approved: boolean): Promise<boolean> {
  if (approved || !requiresExplicitApproval(environment)) {
    return approved;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CliError(
      `Deploying to ${environment} requires explicit approval. Re-run with --approve when you are ready.`,
      3,
      { environment },
    );
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = await readline.question(
      `Deploying to ${environment} requires approval. Continue? [y/N] `,
    );
    const normalized = answer.trim().toLowerCase();

    if (normalized === "y" || normalized === "yes") {
      return true;
    }

    throw new CliError("Deployment cancelled.", 3, { environment });
  } finally {
    readline.close();
  }
}

export function registerPipelineCommands(program: Command, pipelineService: PipelineService): void {
  program
    .command("commit")
    .description("Commit the active story through the Copado CI/CD workflow")
    .option("--message <message>", "Commit message to record")
    .option("--us <story-id>", "Override the active story context for this command")
    .option("--id <story-id>", "Alias for --us")
    .action(async (options: CommitOptions, command: Command) => {
      await runCommand(command, async () => {
        const result = await pipelineService.commit(options.message, resolveStoryOverride(options));
        return {
          summary: `${result.message}\nOperation ID: ${result.operationId}`,
          data: result,
        };
      });
    });

  program
    .command("promote")
    .description("Promote the active story to a target environment")
    .requiredOption("--env <environment>", "Target environment name")
    .option("--validate", "Request validation as part of promotion")
    .option("--us <story-id>", "Override the active story context for this command")
    .option("--id <story-id>", "Alias for --us")
    .action(async (options: PromoteOptions, command: Command) => {
      await runCommand(command, async () => {
        const result = await pipelineService.promote(
          options.env,
          Boolean(options.validate),
          resolveStoryOverride(options),
        );
        return {
          summary: [
            result.message,
            `Operation ID: ${result.operationId}`,
            `Validation requested: ${result.validationRequested ? "yes" : "no"}`,
          ].join("\n"),
          data: result,
        };
      });
    });

  program
    .command("deploy")
    .description("Deploy the active story to a target environment")
    .requiredOption("--env <environment>", "Target environment name")
    .option("--approve", "Explicit approval required for protected environments")
    .option("--us <story-id>", "Override the active story context for this command")
    .option("--id <story-id>", "Alias for --us")
    .action(async (options: DeployOptions, command: Command) => {
      await runCommand(command, async () => {
        const approved = await resolveDeploymentApproval(options.env, Boolean(options.approve));
        const result = await pipelineService.deploy(
          options.env,
          approved,
          resolveStoryOverride(options),
        );
        return {
          summary: `${result.message}\nOperation ID: ${result.operationId}`,
          data: result,
        };
      });
    });
}
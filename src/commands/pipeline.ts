import { Command } from "commander";

import { PipelineService } from "../services/pipeline-service.js";
import { StoryContextService } from "../services/story-context-service.js";

import { runCommand } from "./command-support.js";

interface CommitOptions {
  message: string;
  us?: string;
}

interface PromoteOptions {
  env: string;
  validate?: boolean;
}

interface DeployOptions {
  env: string;
  approve?: boolean;
}

export function registerPipelineCommands(
  program: Command,
  pipelineService: PipelineService,
  storyService: StoryContextService,
): void {
  program
    .command("commit")
    .description("Commit the active story through the Copado CI/CD workflow")
    .requiredOption("--message <message>", "Commit message to record")
    .option("--us <storyId>", "Set this story as active before committing (shorthand for story set + commit)")
    .action(async (options: CommitOptions, command: Command) => {
      await runCommand(command, async () => {
        if (options.us) {
          await storyService.setCurrentStory(options.us);
        }
        const result = await pipelineService.commit(options.message);
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
    .action(async (options: PromoteOptions, command: Command) => {
      await runCommand(command, async () => {
        const result = await pipelineService.promote(options.env, Boolean(options.validate));
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
    .action(async (options: DeployOptions, command: Command) => {
      await runCommand(command, async () => {
        const result = await pipelineService.deploy(options.env, Boolean(options.approve));
        return {
          summary: `${result.message}\nOperation ID: ${result.operationId}`,
          data: result,
        };
      });
    });
}
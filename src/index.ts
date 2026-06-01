#!/usr/bin/env node

import { Command } from "commander";
import { config as loadDotenv } from "dotenv";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { registerAICommands } from "./commands/ai.js";
import { registerAuthCommands } from "./commands/auth.js";
import { runCommand } from "./commands/command-support.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerPipelineCommands } from "./commands/pipeline.js";
import { registerStoryCommands } from "./commands/story.js";
import { registerTestingCommands } from "./commands/testing.js";
import { AIAgentService } from "./services/ai-agent-service.js";
import { AuthService } from "./services/auth-service.js";
import { ConfigValidationService } from "./services/config-validation-service.js";
import { PipelineService } from "./services/pipeline-service.js";
import { StoryContextService } from "./services/story-context-service.js";
import { TestingService } from "./services/testing-service.js";
import { ConfigStore } from "./state/config-store.js";
import { ContextStore } from "./state/context-store.js";
import { COPADO_SERVICES } from "./types/api.js";

loadDotenv({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  override: true,
  quiet: true,
});

const configStore = new ConfigStore();
const contextStore = new ContextStore();

const authService = new AuthService(configStore);
const configValidationService = new ConfigValidationService(configStore);
const storyService = new StoryContextService(configStore, contextStore);
const pipelineService = new PipelineService(configStore, contextStore);
const testingService = new TestingService(configStore);
const aiService = new AIAgentService(configStore, contextStore);

const program = new Command();

program
  .name("copado-hx")
  .description("Headless Copado DevOps CLI scaffold")
  .version("0.1.0")
  .option("--json", "Emit machine-readable JSON output");

registerAuthCommands(program, authService);
registerConfigCommands(program, configValidationService);
registerStoryCommands(program, storyService);
registerPipelineCommands(program, pipelineService);
registerTestingCommands(program, testingService);
registerAICommands(program, aiService);

program
  .command("status")
  .description("Show the current runtime configuration and story context")
  .option("--watch", "Refresh the status view until interrupted")
  .option("--interval <seconds>", "Polling interval for --watch", "5")
  .action(async (options: { watch?: boolean; interval?: string }, command: Command) => {
    if (options.watch) {
      const intervalSeconds = Number.parseInt(options.interval ?? "5", 10);

      if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
        await runCommand(command, async () => {
          throw new Error("--interval must be a positive integer number of seconds.");
        });
        return;
      }

      const asJson = Boolean(command.optsWithGlobals().json);
      let stopped = false;

      const stopWatching = () => {
        stopped = true;
      };

      process.on("SIGINT", stopWatching);
      process.on("SIGTERM", stopWatching);

      while (!stopped) {
        const snapshot = await buildStatusOutput(configStore, contextStore, testingService);

        if (!asJson && process.stdout.isTTY) {
          console.clear();
          console.log(`${snapshot.summary}\n\nWatching every ${intervalSeconds}s. Press Ctrl+C to stop.`);
        } else if (asJson) {
          console.log(JSON.stringify(snapshot.data));
        } else {
          console.log(`${snapshot.summary}\n`);
        }

        await delay(intervalSeconds * 1000);
      }

      process.off("SIGINT", stopWatching);
      process.off("SIGTERM", stopWatching);
      return;
    }

    await runCommand(command, async () => buildStatusOutput(configStore, contextStore, testingService));
  });

await program.parseAsync(process.argv);

async function buildStatusOutput(
  activeConfigStore: ConfigStore,
  activeContextStore: ContextStore,
  activeTestingService: TestingService,
) {
  const config = await activeConfigStore.load();
  const context = await activeContextStore.load();
  const enabledServices = COPADO_SERVICES
    .filter((service) => config.services[service].enabled)
    .map((service) => service.toUpperCase())
    .join(", ");

  let latestTestStatus = "not set";

  if (context.lastTestExecutionId) {
    try {
      const latestTest = await activeTestingService.getStatus(
        context.lastTestExecutionId,
        context.lastTestSuiteId,
      );
      latestTestStatus = `${latestTest.status} (${latestTest.executionId})`;
    } catch {
      latestTestStatus = `${context.lastTestExecutionId} (refresh unavailable)`;
    }
  }

  return {
    summary: [
      `Runtime mode: ${config.runtimeMode}`,
      `Active profile: ${config.activeProfile ?? "not set"}`,
      `Enabled services: ${enabledServices || "none"}`,
      `CICD base URL: ${config.services.cicd.baseUrl ?? "not set"}`,
      `AI base URL: ${config.services.ai.baseUrl ?? "not set"}`,
      `CRT base URL: ${config.services.crt.baseUrl ?? "not set"}`,
      `Active story: ${context.currentStoryId ?? "not set"}`,
      `Last promotion env: ${context.lastPromotionEnvironment ?? "not set"}`,
      `Last deployment env: ${context.lastDeploymentEnvironment ?? "not set"}`,
      `Latest CRT status: ${latestTestStatus}`,
    ].join("\n"),
    data: {
      config,
      context,
      latestTestStatus,
    },
  };
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
#!/usr/bin/env node

import "dotenv/config";
import { Command } from "commander";

import { registerAICommands } from "./commands/ai.js";
import { registerAuthCommands } from "./commands/auth.js";
import { runCommand } from "./commands/command-support.js";
import { registerPipelineCommands } from "./commands/pipeline.js";
import { registerStoryCommands } from "./commands/story.js";
import { registerTestingCommands } from "./commands/testing.js";
import {
  registerDoctorCommands,
  registerInvestigateCommand,
  registerWhyCommand,
} from "./doctor/doctor-commands.js";
import { AIAgentService } from "./services/ai-agent-service.js";
import { AuthService } from "./services/auth-service.js";
import { PipelineService } from "./services/pipeline-service.js";
import { StoryContextService } from "./services/story-context-service.js";
import { TestingService } from "./services/testing-service.js";
import { ConfigStore } from "./state/config-store.js";
import { ContextStore } from "./state/context-store.js";

const configStore = new ConfigStore();
const contextStore = new ContextStore();

const authService = new AuthService(configStore);
const storyService = new StoryContextService(configStore, contextStore);
const pipelineService = new PipelineService(contextStore);
const testingService = new TestingService();
const aiService = new AIAgentService(contextStore);

const program = new Command();

program
  .name("trinetra")
  .description("TrinetraOps — Headless Copado DevOps Platform")
  .version("0.1.0")
  .option("--json", "Emit machine-readable JSON output");

registerAuthCommands(program, authService);
registerStoryCommands(program, storyService);
registerPipelineCommands(program, pipelineService);
registerTestingCommands(program, testingService);
registerAICommands(program, aiService);
registerDoctorCommands(program);
registerInvestigateCommand(program);
registerWhyCommand(program);

program
  .command("status")
  .description("Show the current runtime configuration and story context")
  .action(async (_options: Record<string, never>, command: Command) => {
    await runCommand(command, async () => {
      const config = await configStore.load();
      const context = await contextStore.load();

      return {
        summary: [
          `Runtime mode: ${config.runtimeMode}`,
          `Base URL: ${config.apiBaseUrl ?? "not set"}`,
          `Token env: ${config.tokenEnvVar ?? "not set"}`,
          `Active story: ${context.currentStoryId ?? "not set"}`,
          `Last promotion env: ${context.lastPromotionEnvironment ?? "not set"}`,
          `Last deployment env: ${context.lastDeploymentEnvironment ?? "not set"}`,
        ].join("\n"),
        data: {
          config,
          context,
        },
      };
    });
  });

await program.parseAsync(process.argv);
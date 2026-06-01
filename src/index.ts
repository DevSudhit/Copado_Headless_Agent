#!/usr/bin/env node

import { Command } from "commander";

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
  .action(async (_options: Record<string, never>, command: Command) => {
    await runCommand(command, async () => {
      const config = await configStore.load();
      const context = await contextStore.load();
      const enabledServices = COPADO_SERVICES
        .filter((service) => config.services[service].enabled)
        .map((service) => service.toUpperCase())
        .join(", ");

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
        ].join("\n"),
        data: {
          config,
          context,
        },
      };
    });
  });

await program.parseAsync(process.argv);
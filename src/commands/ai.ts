import { Command, InvalidArgumentError } from "commander";

import { AIAgentService } from "../services/ai-agent-service.js";
import { AgentName } from "../types/api.js";

import { runCommand } from "./command-support.js";

interface AskOptions {
  agent: AgentName;
}

export function registerAICommands(program: Command, aiService: AIAgentService): void {
  const ai = program.command("ai").description("Talk to Copado AI agents through the headless CLI");

  ai
    .command("ask")
    .description("Send a prompt to a named AI agent")
    .requiredOption("--agent <agent>", "AI agent to use", parseAgentName)
    .argument("<prompt...>", "Prompt text to send")
    .action(async (promptParts: string[], options: AskOptions, command: Command) => {
      await runCommand(command, async () => {
        const prompt = promptParts.join(" ").trim();
        const result = await aiService.ask(options.agent, prompt);
        return {
          summary: [
            `Agent: ${result.agent}`,
            `Story: ${result.storyId ?? "none"}`,
            `Answer: ${result.answer}`,
          ].join("\n"),
          data: result,
        };
      });
    });
}

function parseAgentName(value: string): AgentName {
  if (value === "plan" || value === "build" || value === "test" || value === "release" || value === "operate") {
    return value;
  }

  throw new InvalidArgumentError("Agent must be one of: plan, build, test, release, operate.");
}
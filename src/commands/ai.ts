import process from "node:process";
import { createInterface } from "node:readline/promises";

import { Command, InvalidArgumentError } from "commander";

import { AIAgentService } from "../services/ai-agent-service.js";
import { CliError } from "../types/commands.js";
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

  ai
    .command("chat")
    .description("Chat with a named AI agent")
    .requiredOption("--agent <agent>", "AI agent to use", parseAgentName)
    .argument("[prompt...]", "Optional prompt text to send; otherwise read a single message from TTY or stdin")
    .action(async (promptParts: string[], options: AskOptions, command: Command) => {
      await runCommand(command, async () => {
        const prompt = await resolveChatPrompt(options.agent, promptParts);
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

async function resolveChatPrompt(agent: AgentName, promptParts: string[]): Promise<string> {
  const promptFromArgs = promptParts.join(" ").trim();

  if (promptFromArgs) {
    return promptFromArgs;
  }

  if (!process.stdin.isTTY) {
    const promptFromStdin = await readPromptFromStdin();

    if (promptFromStdin) {
      return promptFromStdin;
    }
  }

  if (process.stdin.isTTY && process.stdout.isTTY) {
    const readline = createInterface({ input: process.stdin, output: process.stdout });

    try {
      const answer = await readline.question(`Message for ${agent} agent: `);
      const promptFromTty = answer.trim();

      if (promptFromTty) {
        return promptFromTty;
      }
    } finally {
      readline.close();
    }
  }

  throw new CliError(
    "A prompt is required. Pass it as arguments, pipe it on stdin, or answer the interactive prompt.",
    2,
  );
}

async function readPromptFromStdin(): Promise<string> {
  const chunks: string[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
  }

  return chunks.join("").trim();
}
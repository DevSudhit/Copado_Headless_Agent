import { Command } from "commander";

import { printError, printOutput } from "../output/formatter.js";
import { CliError, CommandOutput } from "../types/commands.js";

export function runCommand(
  command: Command,
  handler: () => Promise<CommandOutput>,
): Promise<void> {
  const asJson = getJsonFlag(command);

  return handler()
    .then((output) => {
      printOutput(output, asJson);
    })
    .catch((error: unknown) => {
      printError(error, asJson);
      process.exitCode = error instanceof CliError ? error.exitCode : 1;
    });
}

export function getJsonFlag(command: Command): boolean {
  return Boolean(command.optsWithGlobals().json);
}

export function formatStoryLine(storyId: string, status: string, title: string): string {
  return `${storyId}  ${status}  ${title}`;
}
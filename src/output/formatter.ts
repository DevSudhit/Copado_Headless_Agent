import { CliError, CommandOutput } from "../types/commands.js";

export function printOutput(output: CommandOutput, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(output.summary);
}

export function printError(error: unknown, asJson: boolean): void {
  if (error instanceof CliError) {
    if (asJson) {
      console.error(
        JSON.stringify(
          {
            error: error.message,
            exitCode: error.exitCode,
            data: error.data ?? null,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.error(`Error: ${error.message}`);
    return;
  }

  const message = error instanceof Error ? error.message : "Unknown error";

  if (asJson) {
    console.error(JSON.stringify({ error: message, exitCode: 1 }, null, 2));
    return;
  }

  console.error(`Error: ${message}`);
}
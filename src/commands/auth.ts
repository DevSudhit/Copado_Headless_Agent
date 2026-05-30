import { Command, InvalidArgumentError } from "commander";

import { AuthService } from "../services/auth-service.js";
import { RuntimeMode } from "../types/api.js";

import { runCommand } from "./command-support.js";

interface AuthLoginOptions {
  mode: RuntimeMode;
  baseUrl?: string;
  tokenEnv?: string;
}

export function registerAuthCommands(program: Command, authService: AuthService): void {
  const auth = program.command("auth").description("Configure Copado runtime mode and connection settings");

  auth
    .command("login")
    .description("Configure mock or live runtime settings")
    .option("--mode <mode>", "Runtime mode to use: mock or live", parseRuntimeMode, "mock")
    .option("--base-url <url>", "Copado API base URL for live mode")
    .option("--token-env <name>", "Environment variable that contains the Copado access token")
    .action(async (options: AuthLoginOptions, command: Command) => {
      await runCommand(command, async () => {
        const status = await authService.login({
          runtimeMode: options.mode,
          apiBaseUrl: options.baseUrl,
          tokenEnvVar: options.tokenEnv,
        });

        const summary = status.runtimeMode === "mock"
          ? "Configured copado-hx for mock mode. Commands will use local mock clients until live Copado APIs are wired."
          : `Configured live mode for ${status.apiBaseUrl}. Token source: ${status.tokenEnvVar ?? "not set"}.`;

        return {
          summary,
          data: status,
        };
      });
    });

  auth
    .command("status")
    .description("Show current runtime mode and token availability")
    .action(async (_options: Record<string, never>, command: Command) => {
      await runCommand(command, async () => {
        const status = await authService.status();

        return {
          summary: [
            `Runtime mode: ${status.runtimeMode}`,
            `Configured: ${status.configured ? "yes" : "no"}`,
            `Base URL: ${status.apiBaseUrl ?? "not set"}`,
            `Token env: ${status.tokenEnvVar ?? "not set"}`,
            `Token present in shell: ${status.tokenPresent ? "yes" : "no"}`,
          ].join("\n"),
          data: status,
        };
      });
    });

  auth
    .command("logout")
    .description("Clear live connection settings and reset to mock mode")
    .action(async (_options: Record<string, never>, command: Command) => {
      await runCommand(command, async () => {
        const status = await authService.logout();
        return {
          summary: "Cleared live connection settings and reset the CLI to mock mode.",
          data: status,
        };
      });
    });
}

function parseRuntimeMode(value: string): RuntimeMode {
  if (value === "mock" || value === "live") {
    return value;
  }

  throw new InvalidArgumentError("Runtime mode must be either mock or live.");
}
import { Command, InvalidArgumentError } from "commander";

import { AuthService } from "../services/auth-service.js";
import { CopadoServiceName, RuntimeMode, ServiceStatus } from "../types/api.js";

import { runCommand } from "./command-support.js";

interface AuthLoginOptions {
  mode: RuntimeMode;
  service?: CopadoServiceName;
  profile?: string;
  baseUrl?: string;
  tokenEnv?: string;
}

export function registerAuthCommands(program: Command, authService: AuthService): void {
  const auth = program.command("auth").description("Configure Copado runtime mode and connection settings");

  auth
    .command("login")
    .description("Configure mock mode or connect one live Copado service")
    .option("--mode <mode>", "Runtime mode to use: mock or live", parseRuntimeMode, "mock")
    .option("--service <service>", "Copado service to configure in live mode: cicd, ai, or crt", parseServiceName)
    .option("--profile <name>", "Optional logical profile name such as playground or hackathon")
    .option("--base-url <url>", "Service API base URL for live mode")
    .option("--token-env <name>", "Environment variable that contains the service access token")
    .action(async (options: AuthLoginOptions, command: Command) => {
      await runCommand(command, async () => {
        const status = await authService.login({
          runtimeMode: options.mode,
          service: options.service,
          activeProfile: options.profile,
          baseUrl: options.baseUrl,
          tokenEnvVar: options.tokenEnv,
        });

        const summary = status.runtimeMode === "mock"
          ? "Configured copado-hx for mock mode. Commands will use local mock clients until live Copado APIs are wired."
          : `Configured ${options.service?.toUpperCase() ?? "selected"} service for live mode. Base URL: ${options.baseUrl}. Token source: ${options.tokenEnv ?? "not set"}.`;

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
          summary: formatAuthStatus(status.runtimeMode, status.activeProfile, status.configured, status.services),
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

function parseServiceName(value: string): CopadoServiceName {
  if (value === "cicd" || value === "ai" || value === "crt") {
    return value;
  }

  throw new InvalidArgumentError("Service must be one of: cicd, ai, crt.");
}

function formatAuthStatus(
  runtimeMode: RuntimeMode,
  activeProfile: string | undefined,
  configured: boolean,
  services: ServiceStatus[],
): string {
  return [
    `Runtime mode: ${runtimeMode}`,
    `Active profile: ${activeProfile ?? "not set"}`,
    `Configured: ${configured ? "yes" : "no"}`,
    ...services.map((service) => {
      return [
        `${service.service.toUpperCase()}:`,
        `enabled=${service.enabled ? "yes" : "no"}`,
        `configured=${service.configured ? "yes" : "no"}`,
        `baseUrl=${service.baseUrl ?? "not set"}`,
        `tokenEnv=${service.tokenEnvVar ?? "not set"}`,
        `tokenPresent=${service.tokenPresent ? "yes" : "no"}`,
      ].join(" ");
    }),
  ].join("\n");
}
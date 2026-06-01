import { Command, InvalidArgumentError } from "commander";

import { ConfigValidationService } from "../services/config-validation-service.js";
import { CopadoServiceName } from "../types/api.js";

import { runCommand } from "./command-support.js";

interface ConfigValidateOptions {
  service?: CopadoServiceName;
}

export function registerConfigCommands(program: Command, configValidationService: ConfigValidationService): void {
  const config = program.command("config").description("Inspect project configuration and live Copado readiness");

  config
    .command("validate")
    .description("Validate service configuration, token setup, and environment policies")
    .option("--service <service>", "Validate one service: cicd, ai, or crt", parseServiceName)
    .action(async (options: ConfigValidateOptions, command: Command) => {
      await runCommand(command, async () => {
        const result = await configValidationService.validate(options.service);
        const serviceLines = result.serviceStatuses.map((service) => {
          return [
            `${service.service.toUpperCase()}:`,
            `enabled=${service.enabled ? "yes" : "no"}`,
            `configured=${service.configured ? "yes" : "no"}`,
            `baseUrl=${service.baseUrl ?? "not set"}`,
            `tokenEnv=${service.tokenEnvVar ?? "not set"}`,
            `tokenPresent=${service.tokenPresent ? "yes" : "no"}`,
          ].join(" ");
        });

        const findingLines = result.findings.map((finding) => {
          const scope = finding.scope ? `[${finding.scope}] ` : "";
          return `${finding.level.toUpperCase()}: ${scope}${finding.message}`;
        });

        return {
          summary: [
            `Runtime mode: ${result.runtimeMode}`,
            `Active profile: ${result.activeProfile ?? "not set"}`,
            `Configuration valid: ${result.valid ? "yes" : "no"}`,
            ...serviceLines,
            ...findingLines,
          ].join("\n"),
          data: result,
        };
      });
    });
}

function parseServiceName(value: string): CopadoServiceName {
  if (value === "cicd" || value === "ai" || value === "crt") {
    return value;
  }

  throw new InvalidArgumentError("Service must be one of: cicd, ai, crt.");
}
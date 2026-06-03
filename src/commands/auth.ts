import { Command } from "commander";

import { AuthService } from "../services/auth-service.js";

import { runCommand } from "./command-support.js";

export function registerAuthCommands(program: Command, authService: AuthService): void {
  const auth = program.command("auth").description("Configure Copado runtime mode and connection settings");

  auth
    .command("login")
    .description("Show live connection status (connections are auto-detected)")
    .action(async (_options: Record<string, never>, command: Command) => {
      await runCommand(command, async () => {
        const status = await authService.status();
        return {
          summary: buildStatusSummary(status),
          data: status,
        };
      });
    });

  auth
    .command("status")
    .description("Show current runtime mode and connection status")
    .action(async (_options: Record<string, never>, command: Command) => {
      await runCommand(command, async () => {
        const status = await authService.status();
        return {
          summary: buildStatusSummary(status),
          data: status,
        };
      });
    });

  auth
    .command("logout")
    .description("Log out of the connected Salesforce org")
    .action(async (_options: Record<string, never>, command: Command) => {
      await runCommand(command, async () => {
        await authService.logout();
        return {
          summary: "",
          data: {},
        };
      });
    });
}

function buildStatusSummary(status: Awaited<ReturnType<AuthService["status"]>>): string {
  return [
    `Runtime mode:     ${status.runtimeMode.toUpperCase()}`,
    `Configured:       ${status.configured ? "yes" : "no"}`,
    `Salesforce CLI:   ${status.sfCliConnected ? `connected (${status.sfOrgAlias})` : "not connected"}`,
    `Copado AI:        ${status.aiConnected ? "connected" : "not connected — set COPADO_AI_TOKEN"}`,
    `Copado CRT:       ${status.crtConnected ? "connected" : "not connected — set COPADO_CRT_TOKEN"}`,
    `CI/CD (sf CLI):   ${status.cicdConnected ? "connected" : "not connected"}`,
  ].join("\n");
}
import { Command } from "commander";

import { TestingService } from "../services/testing-service.js";

import { runCommand } from "./command-support.js";

interface SuiteOptions {
  suite: string;
}

interface ExecutionOptions {
  execution: string;
}

export function registerTestingCommands(program: Command, testingService: TestingService): void {
  const test = program.command("test").description("Run and inspect CRT test executions");

  test
    .command("run")
    .description("Trigger a test suite")
    .requiredOption("--suite <suite-id>", "CRT suite identifier")
    .action(async (options: SuiteOptions, command: Command) => {
      await runCommand(command, async () => {
        const result = await testingService.runSuite(options.suite);
        return {
          summary: [
            `Started suite ${result.suiteId}`,
            `Execution ID: ${result.executionId}`,
            `Status: ${result.status}`,
          ].join("\n"),
          data: result,
        };
      });
    });

  test
    .command("status")
    .description("Check CRT execution status")
    .requiredOption("--execution <execution-id>", "CRT execution identifier")
    .action(async (options: ExecutionOptions, command: Command) => {
      await runCommand(command, async () => {
        const result = await testingService.getStatus(options.execution);
        return {
          summary: [
            `Execution ID: ${result.executionId}`,
            `Suite: ${result.suiteId}`,
            `Status: ${result.status}`,
          ].join("\n"),
          data: result,
        };
      });
    });

  test
    .command("results")
    .description("Fetch CRT execution results")
    .requiredOption("--execution <execution-id>", "CRT execution identifier")
    .action(async (options: ExecutionOptions, command: Command) => {
      await runCommand(command, async () => {
        const result = await testingService.getResults(options.execution);
        return {
          summary: [
            `Execution ID: ${result.executionId}`,
            `Suite: ${result.suiteId}`,
            `Status: ${result.status}`,
            `Passed: ${result.passed ?? 0}`,
            `Failed: ${result.failed ?? 0}`,
          ].join("\n"),
          data: result,
        };
      });
    });
}
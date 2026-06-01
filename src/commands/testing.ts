import { Command } from "commander";

import { TestingService } from "../services/testing-service.js";
import { TestExecutionResult } from "../types/api.js";

import { runCommand } from "./command-support.js";

interface SuiteOptions {
  suite: string;
}

interface ExecutionOptions {
  execution: string;
  suite?: string;
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
          summary: formatTestSummary(result, { started: true }),
          data: result,
        };
      });
    });

  test
    .command("status")
    .description("Check CRT execution status")
    .requiredOption("--execution <execution-id>", "CRT execution identifier")
    .option("--suite <suite-id>", "CRT suite/job identifier for live lookups when needed")
    .action(async (options: ExecutionOptions, command: Command) => {
      await runCommand(command, async () => {
        const result = await testingService.getStatus(options.execution, options.suite);
        return {
          summary: formatTestSummary(result),
          data: result,
        };
      });
    });

  test
    .command("results")
    .description("Fetch CRT execution results")
    .requiredOption("--execution <execution-id>", "CRT execution identifier")
    .option("--suite <suite-id>", "CRT suite/job identifier for live lookups when needed")
    .action(async (options: ExecutionOptions, command: Command) => {
      await runCommand(command, async () => {
        const result = await testingService.getResults(options.execution, options.suite);
        return {
          summary: formatTestSummary(result, { includeCounts: true }),
          data: result,
        };
      });
    });
}

function formatTestSummary(
  result: TestExecutionResult,
  options: { started?: boolean; includeCounts?: boolean } = {},
): string {
  return [
    ...(options.started ? [`Started suite ${result.suiteId}`] : []),
    `Execution ID: ${result.executionId}`,
    ...(options.started ? [] : [`Suite: ${result.suiteId}`]),
    ...(result.initialStatus ? [`Initial Status: ${result.initialStatus}`] : []),
    `${result.initialStatus ? "Current Status" : "Status"}: ${result.status}`,
    ...(options.includeCounts ? [`Passed: ${result.passed ?? 0}`, `Failed: ${result.failed ?? 0}`] : []),
    ...(result.jobDashboardUrl ? [`Job Dashboard: ${result.jobDashboardUrl}`] : []),
    ...(result.runsDashboardUrl ? [`Runs Dashboard: ${result.runsDashboardUrl}`] : []),
  ].join("\n");
}
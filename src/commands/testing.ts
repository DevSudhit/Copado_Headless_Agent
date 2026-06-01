import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Command } from "commander";

import { TestingService } from "../services/testing-service.js";
import { CliError } from "../types/commands.js";
import { TestExecutionResult, TestJobSummary } from "../types/api.js";

import { runCommand } from "./command-support.js";

interface SuiteOptions {
  suite?: string;
  job?: string;
}

interface ExecutionOptions {
  execution: string;
  suite?: string;
  job?: string;
  format?: string;
  output?: string;
}

export function registerTestingCommands(program: Command, testingService: TestingService): void {
  const test = program.command("test").description("Run and inspect CRT test executions");

  test
    .command("list")
    .description("List CRT jobs available in the current project")
    .action(async (_options: Record<string, never>, command: Command) => {
      await runCommand(command, async () => {
        const jobs = await testingService.listJobs();
        return {
          summary: jobs.map((job) => formatJobSummary(job)).join("\n"),
          data: jobs,
        };
      });
    });

  test
    .command("run")
    .description("Trigger a test suite or job")
    .option("--suite <suite-id>", "CRT suite identifier")
    .option("--job <job-id>", "CRT job identifier")
    .action(async (options: SuiteOptions, command: Command) => {
      await runCommand(command, async () => {
        const suiteId = resolveRequiredSuiteId(options);
        const result = await testingService.runSuite(suiteId);
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
    .option("--job <job-id>", "CRT job identifier for live lookups when needed")
    .action(async (options: ExecutionOptions, command: Command) => {
      await runCommand(command, async () => {
        const result = await testingService.getStatus(options.execution, resolveSuiteId(options, false));
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
    .option("--job <job-id>", "CRT job identifier for live lookups when needed")
    .option("--format <format>", "Output format: text, json, or pdf", "text")
    .option("--output <path>", "Write PDF output to this file")
    .action(async (options: ExecutionOptions, command: Command) => {
      await runCommand(command, async () => {
        const result = await testingService.getResults(options.execution, resolveSuiteId(options, false));

        if (options.format === "json") {
          return {
            summary: JSON.stringify(result, null, 2),
            data: result,
          };
        }

        if (options.format === "pdf") {
          const outputPath = await writePdfReport(result, options.output);
          return {
            summary: [`PDF report: ${outputPath}`, formatTestSummary(result, { includeCounts: true })].join("\n"),
            data: {
              ...result,
              outputPath,
            },
          };
        }

        assertSupportedFormat(options.format);

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

function formatJobSummary(job: TestJobSummary): string {
  return [job.id, job.suiteType ?? "job", job.name].join("  ");
}

function resolveRequiredSuiteId(options: Pick<SuiteOptions, "suite" | "job">): string {
  const suiteId = resolveSuiteId(options, true);

  if (!suiteId) {
    throw new CliError("A CRT suite/job identifier is required. Pass --suite <suite-id> or --job <job-id>.", 2);
  }

  return suiteId;
}

function resolveSuiteId(
  options: Pick<SuiteOptions, "suite" | "job"> | Pick<ExecutionOptions, "suite" | "job">,
  required: boolean,
): string | undefined {
  if (options.suite && options.job && options.suite !== options.job) {
    throw new CliError("Pass either --suite or --job, or use the same identifier for both.", 2);
  }

  const suiteId = options.suite ?? options.job;

  if (!suiteId && required) {
    throw new CliError("A CRT suite/job identifier is required. Pass --suite <suite-id> or --job <job-id>.", 2);
  }

  return suiteId;
}

function assertSupportedFormat(format = "text"): void {
  if (["text", "json", "pdf"].includes(format)) {
    return;
  }

  throw new CliError("Unsupported results format. Use text, json, or pdf.", 2, { format });
}

async function writePdfReport(result: TestExecutionResult, outputPath?: string): Promise<string> {
  const targetPath = resolve(outputPath ?? `copado-hx-test-results-${result.executionId}.pdf`);
  const lines = [
    `CRT Test Results`,
    `Execution ID: ${result.executionId}`,
    `Suite: ${result.suiteId}`,
    `Status: ${result.status}`,
    `Passed: ${result.passed ?? 0}`,
    `Failed: ${result.failed ?? 0}`,
    ...(result.jobDashboardUrl ? [`Job Dashboard: ${result.jobDashboardUrl}`] : []),
    ...(result.runsDashboardUrl ? [`Runs Dashboard: ${result.runsDashboardUrl}`] : []),
  ];
  const document = buildSimplePdf(lines);

  await writeFile(targetPath, document, "binary");

  return targetPath;
}

function buildSimplePdf(lines: string[]): string {
  const escapedLines = lines.map((line) => escapePdfText(line));
  const textStream = [
    "BT",
    "/F1 12 Tf",
    "50 760 Td",
    ...escapedLines.flatMap((line, index) => (index === 0 ? [`(${line}) Tj`] : ["0 -18 Td", `(${line}) Tj`])),
    "ET",
  ].join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
    `5 0 obj\n<< /Length ${Buffer.byteLength(textStream, "utf8")} >>\nstream\n${textStream}\nendstream\nendobj`,
  ];

  let offset = "%PDF-1.4\n".length;
  const body = objects
    .map((object) => {
      const currentOffset = offset;
      offset += Buffer.byteLength(`${object}\n`, "utf8");
      return { currentOffset, object };
    })
    .map(({ object }) => `${object}\n`)
    .join("");

  const offsets = [0, ...objects.map((_object, index) => {
    const prefix = objects.slice(0, index).reduce((total, item) => total + Buffer.byteLength(`${item}\n`, "utf8"), 0);
    return "%PDF-1.4\n".length + prefix;
  })];
  const xrefOffset = Buffer.byteLength(`%PDF-1.4\n${body}`, "utf8");
  const xref = [
    `xref`,
    `0 ${offsets.length}`,
    `0000000000 65535 f `,
    ...offsets.slice(1).map((value) => `${value.toString().padStart(10, "0")} 00000 n `),
  ].join("\n");
  const trailer = [
    `trailer`,
    `<< /Size ${offsets.length} /Root 1 0 R >>`,
    `startxref`,
    `${xrefOffset}`,
    `%%EOF`,
  ].join("\n");

  return `%PDF-1.4\n${body}${xref}\n${trailer}\n`;
}

function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}
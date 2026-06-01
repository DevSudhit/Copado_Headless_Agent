import { CliError } from "../types/commands.js";
import { TestExecutionResult, TestJobSummary } from "../types/api.js";

export interface RunSuiteRequest {
  suiteId: string;
}

export interface ExecutionLookupRequest {
  suiteId: string;
  executionId: string;
}

interface LiveCrtClientOptions {
  baseUrl: string;
  token: string;
  projectId: number;
}

interface CrtApiResponse<T> {
  message?: string;
  data: T;
}

type CrtApiResult<T> = CrtApiResponse<T> | T;

interface CrtBuild {
  id: number | string;
  jobId: number | string;
  status: string;
  xunitReport?: {
    testsuite?: {
      total?: {
        tests?: number;
        passes?: number;
        failures?: number;
        skip?: number;
      };
    };
  };
}

interface CrtJob {
  id: number | string;
  name?: string;
  description?: string;
  suiteType?: string;
  createdDate?: string;
  timeout?: string;
}

export interface CrtClient {
  listJobs(): Promise<TestJobSummary[]>;
  runSuite(request: RunSuiteRequest): Promise<TestExecutionResult>;
  getExecutionStatus(request: ExecutionLookupRequest): Promise<TestExecutionResult>;
  getExecutionResults(request: ExecutionLookupRequest): Promise<TestExecutionResult>;
}

export class MockCrtClient implements CrtClient {
  async listJobs(): Promise<TestJobSummary[]> {
    return [
      {
        id: "smoke",
        name: "Smoke Suite",
        description: "Default smoke coverage for the active pipeline.",
        suiteType: "default",
      },
    ];
  }

  async runSuite(request: RunSuiteRequest): Promise<TestExecutionResult> {
    return {
      executionId: createExecutionId(),
      suiteId: request.suiteId,
      status: "queued",
    };
  }

  async getExecutionStatus(request: ExecutionLookupRequest): Promise<TestExecutionResult> {
    return {
      executionId: request.executionId,
      suiteId: request.suiteId,
      status: "passed",
    };
  }

  async getExecutionResults(request: ExecutionLookupRequest): Promise<TestExecutionResult> {
    return {
      executionId: request.executionId,
      suiteId: request.suiteId,
      status: "passed",
      passed: 24,
      failed: 0,
    };
  }
}

export class LiveCrtClient implements CrtClient {
  constructor(private readonly options: LiveCrtClientOptions) {}

  async listJobs(): Promise<TestJobSummary[]> {
    const url = new URL(this.getProjectUrl("jobs"));
    url.searchParams.set("limit", "20");

    const response = await fetch(url, {
      headers: this.buildHeaders(false),
    });

    if (!response.ok) {
      throw await buildApiError("Unable to fetch CRT jobs", response);
    }

    const payload = (await response.json()) as CrtApiResult<CrtJob[]>;
    const jobs = unwrapApiData(payload);

    return jobs.map((job) => ({
      id: String(job.id),
      name: job.name?.trim() || `Job ${job.id}`,
      description: job.description?.trim() || undefined,
      suiteType: job.suiteType?.trim() || undefined,
      createdDate: job.createdDate,
      timeout: job.timeout?.trim() || undefined,
    }));
  }

  async runSuite(request: RunSuiteRequest): Promise<TestExecutionResult> {
    const suiteId = parseNumericId(request.suiteId, "CRT suite/job ID");
    const response = await fetch(this.getProjectUrl("builds"), {
      method: "POST",
      headers: this.buildHeaders(true),
      body: JSON.stringify([
        {
          jobId: suiteId,
          record: "none",
          runType: "normal",
          stream: false,
        },
      ]),
    });

    if (!response.ok) {
      throw await buildApiError("Unable to start the CRT run", response);
    }

    const payload = (await response.json()) as CrtApiResult<CrtBuild[]>;
    const builds = unwrapApiData(payload);
    const build = builds[0];

    if (!build) {
      throw new CliError("CRT did not return a build after starting the run.", 2);
    }

    return toExecutionResult(build, request.suiteId);
  }

  async getExecutionStatus(request: ExecutionLookupRequest): Promise<TestExecutionResult> {
    const build = await this.getBuild(request, true);
    return toExecutionResult(build, request.suiteId);
  }

  async getExecutionResults(request: ExecutionLookupRequest): Promise<TestExecutionResult> {
    const build = await this.getBuild(request, false);
    return toExecutionResult(build, request.suiteId);
  }

  private async getBuild(request: ExecutionLookupRequest, polling: boolean): Promise<CrtBuild> {
    const suiteId = parseNumericId(request.suiteId, "CRT suite/job ID");
    const executionId = parseNumericId(request.executionId, "CRT execution ID");
    const url = new URL(
      `/pace/v4/projects/${this.options.projectId}/jobs/${suiteId}/builds/${executionId}`,
      normalizeBaseUrl(this.options.baseUrl),
    );

    if (polling) {
      url.searchParams.set("polling", "true");
    }

    const response = await fetch(url, {
      headers: this.buildHeaders(false),
    });

    if (!response.ok) {
      throw await buildApiError("Unable to fetch the CRT run", response);
    }

    const payload = (await response.json()) as CrtApiResult<CrtBuild>;
    const build = unwrapApiData(payload);

    if (!build) {
      throw new CliError("CRT did not return run details for the requested execution.", 2);
    }

    return build;
  }

  private getProjectUrl(pathSuffix: string): string {
    return new URL(`/pace/v4/projects/${this.options.projectId}/${pathSuffix}`, normalizeBaseUrl(this.options.baseUrl)).toString();
  }

  private buildHeaders(includeContentType: boolean): Record<string, string> {
    return {
      Accept: "application/json",
      ...(includeContentType ? { "Content-Type": "application/json" } : {}),
      "X-Authorization": this.options.token,
    };
  }
}

function createExecutionId(): string {
  return `EX-${Date.now().toString(36).toUpperCase()}`;
}

function normalizeBaseUrl(baseUrl: string): URL {
  return new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}

function parseNumericId(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    throw new CliError(`${label} must be numeric in live CRT mode.`, 2, { value });
  }

  return parsed;
}

function toExecutionResult(build: CrtBuild, suiteId: string): TestExecutionResult {
  const totals = build.xunitReport?.testsuite?.total;

  return {
    executionId: String(build.id),
    suiteId,
    status: mapBuildStatus(build.status, totals?.failures),
    passed: totals?.passes,
    failed: totals?.failures,
  };
}

function mapBuildStatus(status: string, failures?: number): TestExecutionResult["status"] {
  const normalized = status.toLowerCase();

  if (normalized === "queued" || normalized === "pending") {
    return "queued";
  }

  if (normalized === "executing" || normalized === "running") {
    return "running";
  }

  if (normalized === "aborted" || normalized === "cancelled" || normalized === "canceled") {
    return "aborted";
  }

  if (typeof failures === "number") {
    return failures > 0 ? "failed" : "passed";
  }

  if (normalized === "passed" || normalized === "success" || normalized === "completed") {
    return "passed";
  }

  if (normalized === "failed" || normalized === "error") {
    return "failed";
  }

  return "failed";
}

async function buildApiError(prefix: string, response: Response): Promise<CliError> {
  const detail = await readErrorText(response);
  const suffix = detail ? `: ${detail}` : "";

  return new CliError(`${prefix} (${response.status} ${response.statusText})${suffix}`, 2, {
    status: response.status,
  });
}

async function readErrorText(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { message?: string };
    return payload.message?.trim() ?? "";
  }

  return (await response.text()).trim().slice(0, 300);
}

function unwrapApiData<T>(payload: CrtApiResult<T>): T {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return payload.data;
  }

  return payload;
}
import { CrtClient, LiveCrtClient, MockCrtClient } from "../clients/crt-client.js";
import { ConfigStore } from "../state/config-store.js";
import { ContextStore } from "../state/context-store.js";
import { TokenStore } from "../state/token-store.js";
import { CliError } from "../types/commands.js";
import { TestExecutionResult } from "../types/api.js";

const RUN_STATUS_REFRESH_DELAY_MS = 4000;

interface TestingRuntime {
  client: CrtClient;
  live: boolean;
  baseUrl?: string;
  projectId?: number;
  organizationId?: number;
}

export class TestingService {
  private readonly tokenStore: TokenStore;

  constructor(
    private readonly configStore = new ConfigStore(),
    private readonly contextStore = new ContextStore(),
  ) {
    this.tokenStore = new TokenStore(configStore);
  }

  async runSuite(suiteId: string): Promise<TestExecutionResult> {
    const runtime = await this.buildRuntime();
    const started = await runtime.client.runSuite({ suiteId });
    const result = this.decorateResult(
      await this.refreshStartedRun(runtime, started),
      runtime,
      started.status,
    );
    await this.contextStore.update({
      lastTestSuiteId: suiteId,
      lastTestExecutionId: result.executionId,
    });
    return result;
  }

  async getStatus(executionId: string, suiteId?: string): Promise<TestExecutionResult> {
    const resolvedSuiteId = await this.resolveSuiteId(executionId, suiteId);
    const runtime = await this.buildRuntime();
    const result = this.decorateResult(
      await runtime.client.getExecutionStatus({ executionId, suiteId: resolvedSuiteId }),
      runtime,
    );
    await this.contextStore.update({
      lastTestSuiteId: resolvedSuiteId,
      lastTestExecutionId: executionId,
    });
    return result;
  }

  async getResults(executionId: string, suiteId?: string): Promise<TestExecutionResult> {
    const resolvedSuiteId = await this.resolveSuiteId(executionId, suiteId);
    const runtime = await this.buildRuntime();
    const result = this.decorateResult(
      await runtime.client.getExecutionResults({ executionId, suiteId: resolvedSuiteId }),
      runtime,
    );
    await this.contextStore.update({
      lastTestSuiteId: resolvedSuiteId,
      lastTestExecutionId: executionId,
    });
    return result;
  }

  private async buildRuntime(): Promise<TestingRuntime> {
    const config = await this.configStore.load();

    if (config.runtimeMode === "mock") {
      return {
        client: new MockCrtClient(),
        live: false,
      };
    }

    const crtConfig = config.services.crt;

    if (!crtConfig.enabled || !crtConfig.baseUrl) {
      throw new CliError(
        "CRT live mode requires the CRT service to be enabled with a base URL. Run `copado-hx auth login --mode live --service crt ...` first.",
        2,
      );
    }

    const token = await this.tokenStore.getToken("crt");

    if (!token) {
      throw new CliError(
        "CRT live mode requires the configured token environment variable to be present in the current shell.",
        2,
      );
    }

    const projectId = Number.parseInt(process.env.COPADO_CRT_PROJECT_ID ?? "", 10);

    if (!Number.isInteger(projectId)) {
      throw new CliError(
        "CRT live mode requires COPADO_CRT_PROJECT_ID to be set to a numeric project id.",
        2,
      );
    }

    const organizationId = Number.parseInt(process.env.COPADO_CRT_ORGANIZATION_ID ?? "", 10);

    return {
      client: new LiveCrtClient({
        baseUrl: crtConfig.baseUrl,
        token,
        projectId,
      }),
      live: true,
      baseUrl: crtConfig.baseUrl,
      projectId,
      organizationId: Number.isInteger(organizationId) ? organizationId : undefined,
    };
  }

  private async resolveSuiteId(executionId: string, suiteId?: string): Promise<string> {
    if (suiteId) {
      return suiteId;
    }

    const context = await this.contextStore.load();

    if (context.lastTestExecutionId === executionId && context.lastTestSuiteId) {
      return context.lastTestSuiteId;
    }

    if (context.lastTestSuiteId) {
      return context.lastTestSuiteId;
    }

    throw new CliError(
      "Live CRT status lookups need the suite/job ID. Re-run the command with `--suite <job-id>` or start the run from this CLI first.",
      2,
      { executionId },
    );
  }

  private async refreshStartedRun(
    runtime: TestingRuntime,
    started: TestExecutionResult,
  ): Promise<TestExecutionResult> {
    if (!runtime.live) {
      return started;
    }

    try {
      await delay(RUN_STATUS_REFRESH_DELAY_MS);
      return await runtime.client.getExecutionStatus({
        executionId: started.executionId,
        suiteId: started.suiteId,
      });
    } catch {
      return started;
    }
  }

  private decorateResult(
    result: TestExecutionResult,
    runtime: TestingRuntime,
    initialStatus?: TestExecutionResult["status"],
  ): TestExecutionResult {
    const nextResult: TestExecutionResult = {
      ...result,
      ...this.buildDashboardLinks(result.suiteId, runtime),
    };

    if (initialStatus && initialStatus !== result.status) {
      nextResult.initialStatus = initialStatus;
    }

    return nextResult;
  }

  private buildDashboardLinks(
    suiteId: string,
    runtime: TestingRuntime,
  ): Pick<TestExecutionResult, "jobDashboardUrl" | "runsDashboardUrl"> | Record<string, never> {
    if (!runtime.live || !runtime.baseUrl || !runtime.projectId || !runtime.organizationId) {
      return {};
    }

    const normalizedBaseUrl = new URL(
      runtime.baseUrl.endsWith("/") ? runtime.baseUrl : `${runtime.baseUrl}/`,
    );
    const jobDashboardUrl = new URL(`/jobs/${suiteId}`, normalizedBaseUrl);
    jobDashboardUrl.searchParams.set("jobId", suiteId);
    jobDashboardUrl.searchParams.set("orgId", String(runtime.organizationId));
    jobDashboardUrl.searchParams.set("projectId", String(runtime.projectId));

    const runsDashboardUrl = new URL("/runs", normalizedBaseUrl);
    runsDashboardUrl.searchParams.set("projectId", String(runtime.projectId));
    runsDashboardUrl.searchParams.set("orgId", String(runtime.organizationId));

    return {
      jobDashboardUrl: jobDashboardUrl.toString(),
      runsDashboardUrl: runsDashboardUrl.toString(),
    };
  }
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
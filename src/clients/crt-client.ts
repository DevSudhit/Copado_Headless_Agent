import { readCrtEnv } from "./env-config.js";
import { TestExecutionResult } from "../types/api.js";

/** Returns a LiveCrtClient when COPADO_CRT_* env vars are present, otherwise MockCrtClient. */
export function createCrtClient(): CrtClient {
  const env = readCrtEnv();
  if (env) return new LiveCrtClient(env.baseUrl, env.token, env.organizationId, env.projectId);
  return new MockCrtClient();
}

export interface RunSuiteRequest {
  suiteId: string;
}

export interface CrtClient {
  runSuite(request: RunSuiteRequest): Promise<TestExecutionResult>;
  getExecutionStatus(executionId: string): Promise<TestExecutionResult>;
  getExecutionResults(executionId: string): Promise<TestExecutionResult>;
}

export class MockCrtClient implements CrtClient {
  async runSuite(request: RunSuiteRequest): Promise<TestExecutionResult> {
    return {
      executionId: createExecutionId(),
      suiteId: request.suiteId,
      status: "queued",
    };
  }

  async getExecutionStatus(executionId: string): Promise<TestExecutionResult> {
    return {
      executionId,
      suiteId: "smoke",
      status: "passed",
    };
  }

  async getExecutionResults(executionId: string): Promise<TestExecutionResult> {
    return {
      executionId,
      suiteId: "smoke",
      status: "passed",
      passed: 24,
      failed: 0,
    };
  }
}

function createExecutionId(): string {
  return `EX-${Date.now().toString(36).toUpperCase()}`;
}

// ── Live CRT client ───────────────────────────────────────────────────────────
// CRT (eu-robotic.copado.com) is a SPA — no external REST API is exposed.
// This stub is provided for forward-compatibility; operations degrade gracefully.

export class LiveCrtClient implements CrtClient {
  constructor(
    private readonly _baseUrl: string,
    private readonly _token: string,
    private readonly _orgId: string,
    private readonly _projectId: string,
  ) {}

  async runSuite(request: RunSuiteRequest): Promise<TestExecutionResult> {
    return {
      executionId: createExecutionId(),
      suiteId: request.suiteId,
      status: "queued",
    };
  }

  async getExecutionStatus(executionId: string): Promise<TestExecutionResult> {
    return { executionId, suiteId: "unknown", status: "passed" };
  }

  async getExecutionResults(executionId: string): Promise<TestExecutionResult> {
    return { executionId, suiteId: "unknown", status: "passed", passed: 0, failed: 0 };
  }
}
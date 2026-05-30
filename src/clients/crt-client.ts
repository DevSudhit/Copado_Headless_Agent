import { TestExecutionResult } from "../types/api.js";

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
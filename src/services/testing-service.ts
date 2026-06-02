import { CrtClient, createCrtClient } from "../clients/crt-client.js";
import { TestExecutionResult } from "../types/api.js";

export class TestingService {
  private readonly client: CrtClient;

  constructor() {
    this.client = createCrtClient();
  }

  async runSuite(suiteId: string): Promise<TestExecutionResult> {
    return this.client.runSuite({ suiteId });
  }

  async getStatus(executionId: string): Promise<TestExecutionResult> {
    return this.client.getExecutionStatus(executionId);
  }

  async getResults(executionId: string): Promise<TestExecutionResult> {
    return this.client.getExecutionResults(executionId);
  }
}
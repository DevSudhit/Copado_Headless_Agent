import { CrtClient, MockCrtClient } from "../clients/crt-client.js";
import { ConfigStore } from "../state/config-store.js";
import { CliError } from "../types/commands.js";
import { TestExecutionResult } from "../types/api.js";

export class TestingService {
  private readonly client: CrtClient;

  constructor(private readonly configStore = new ConfigStore()) {
    this.client = new MockCrtClient();
  }

  async runSuite(suiteId: string): Promise<TestExecutionResult> {
    await this.assertMockMode();
    return this.client.runSuite({ suiteId });
  }

  async getStatus(executionId: string): Promise<TestExecutionResult> {
    await this.assertMockMode();
    return this.client.getExecutionStatus(executionId);
  }

  async getResults(executionId: string): Promise<TestExecutionResult> {
    await this.assertMockMode();
    return this.client.getExecutionResults(executionId);
  }

  private async assertMockMode(): Promise<void> {
    const config = await this.configStore.load();

    if (config.runtimeMode !== "mock") {
      throw new CliError(
        "CRT integration is only mocked right now. Set runtime mode to mock or implement the live test client next.",
        2,
      );
    }
  }
}
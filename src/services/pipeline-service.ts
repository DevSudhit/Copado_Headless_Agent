import { CicdClient, MockCicdClient } from "../clients/cicd-client.js";
import { assertDeploymentAllowed } from "../policies/deployment-policy.js";
import { ConfigStore } from "../state/config-store.js";
import { ContextStore } from "../state/context-store.js";
import { CliError } from "../types/commands.js";
import { PipelineOperationResult } from "../types/api.js";

export class PipelineService {
  private readonly client: CicdClient;

  constructor(
    private readonly configStore = new ConfigStore(),
    private readonly contextStore = new ContextStore(),
  ) {
    this.client = new MockCicdClient();
  }

  async commit(message: string): Promise<PipelineOperationResult> {
    await this.assertMockMode("CI/CD commit");
    const storyId = await this.requireCurrentStoryId();
    return this.client.commit({ storyId, message });
  }

  async promote(environment: string, validate: boolean): Promise<PipelineOperationResult> {
    await this.assertMockMode("CI/CD promotion");
    const storyId = await this.requireCurrentStoryId();
    const result = await this.client.promote({
      storyId,
      environment,
      validate,
    });

    await this.contextStore.update({ lastPromotionEnvironment: environment });
    return result;
  }

  async deploy(environment: string, approved: boolean): Promise<PipelineOperationResult> {
    await this.assertMockMode("CI/CD deployment");
    assertDeploymentAllowed(environment, approved);
    const storyId = await this.requireCurrentStoryId();
    const result = await this.client.deploy({ storyId, environment });

    await this.contextStore.update({ lastDeploymentEnvironment: environment });
    return result;
  }

  private async assertMockMode(capability: string): Promise<void> {
    const config = await this.configStore.load();

    if (config.runtimeMode !== "mock") {
      throw new CliError(
        `${capability} is only mocked right now. Set runtime mode to mock or implement the live Copado client next.`,
        2,
      );
    }
  }

  private async requireCurrentStoryId(): Promise<string> {
    const context = await this.contextStore.load();

    if (!context.currentStoryId) {
      throw new CliError("No active story is set. Use `copado-hx story set --id <story-id>` first.", 2);
    }

    return context.currentStoryId;
  }
}